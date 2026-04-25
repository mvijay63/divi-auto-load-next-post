<?php
/**
 * Plugin Name: Divi Auto Load Next Post
 * Plugin URI: https://divibuilderaddons.com/product/divi-auto-load-next-post/
 * Description: Improve user engagement In a Divi-powered WordPress site by seamlessly loading the next blog post as the reader scrolls, without requiring a page refresh.
 * Version: 1.0.0
 * Author: Divi Addons
 * Author URI: https://divibuilderaddons.com/
 * License: GPL v2 or later
 * Text Domain: divi-autoload
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

// Define plugin constants
define('DIVI_AUTOLOAD_VERSION', '1.0.0');
define( 'DIVI_AUTOLOAD_PLUGIN_FILE', __FILE__ );
define('DIVI_AUTOLOAD_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('DIVI_AUTOLOAD_PLUGIN_URL', plugin_dir_url(__FILE__));

class Divi_Auto_Load_Next_Post {
    
    private $options;
    
    public function __construct() {
        // Load options
        $this->options = get_option('divi_autoload_settings');
        
        // Load required files
        $this->load_dependencies();

        // Frontend hooks
        if (!is_admin() && empty($_GET['et_fb'])) {
            add_action('wp_enqueue_scripts', array($this, 'enqueue_scripts'));
            add_action('wp_enqueue_scripts', array($this, 'replace_eztoc_script_with_custom'), 20);
            add_action('et_after_post', array($this, 'comments_toggle_button'));
        }
        
        // AJAX hooks
        add_action('wp_ajax_get_next_post_id', array($this, 'ajax_get_next_post_id'));
        add_action('wp_ajax_nopriv_get_next_post_id', array($this, 'ajax_get_next_post_id'));

        // Easy Table of Contents: wrap auto-inserted TOC markup for styling/targeting (after eztoc_shortcode_html_no_heading_text at priority 10).
        add_filter('eztoc_autoinsert_final_toc_html', array($this, 'wrap_eztoc_autoinsert_html'), 20);
    }

    /**
     * Wrap EZ TOC auto-insert HTML in a container for Divi autoload integration.
     *
     * @param string $html Final TOC HTML from Easy Table of Contents.
     * @return string
     */
    public function wrap_eztoc_autoinsert_html($html) {
        if (!isset($this->options['enable_plugin']) || $this->options['enable_plugin'] != '1') {
            return $html;
        }
        if ('' === trim((string) $html)) {
            return $html;
        }
        return '<div class="ez-toc-instance-root">' . $html . '</div>';
    }
    
    /**
     * Load plugin dependencies
     */
    private function load_dependencies() {
        // Load admin class
        if (is_admin()) {
            require_once DIVI_AUTOLOAD_PLUGIN_DIR . 'admin/class-admin.php';
            new Divi_Auto_Load_Admin();
        }
        
        // Load AJAX handler
        require_once DIVI_AUTOLOAD_PLUGIN_DIR . 'includes/class-ajax-handler.php';
    }
    
    /**
     * Enqueue frontend scripts and styles
     */
    public function enqueue_scripts() {
        // Check if plugin is enabled
        if (!isset($this->options['enable_plugin']) || $this->options['enable_plugin'] != '1') {
            return;
        }
        
        // Only load on single posts
        if (!is_single()) {
            return;
        }

        if(!is_singular('post')){
            return ;
        }
        
        // Enqueue JavaScript
        wp_enqueue_script(
            'divi-autoload-next-post',
            DIVI_AUTOLOAD_PLUGIN_URL . 'js/autoload-next-post.js',
            array('jquery'),
            DIVI_AUTOLOAD_VERSION.time(),
            true
        );
        
        // Pass data to JavaScript
        wp_localize_script('divi-autoload-next-post', 'diviAutoLoad', array(
            'ajaxUrl' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('divi_autoload_nonce'),
            'currentPostId' => get_the_ID(),
            'settings' => array(
                'scrollTrigger' => isset($this->options['scroll_trigger']) ? $this->options['scroll_trigger'] : 30,
                'widgetAutoClose' => isset($this->options['widget_auto_close']) ? $this->options['widget_auto_close'] : 300,
                'buttonPosition' => isset($this->options['button_position']) ? $this->options['button_position'] : 'bottom-right',
                'showProgress' => isset($this->options['show_progress']) ? $this->options['show_progress'] : '1',
                'showTopButton' => isset($this->options['show_top_button']) ? $this->options['show_top_button'] : '1',
                'showBottomButton' => isset($this->options['show_bottom_button']) ? $this->options['show_bottom_button'] : '1',
            )
        ));
        
        // Enqueue CSS
        wp_enqueue_style(
            'divi-autoload-next-post-style',
            DIVI_AUTOLOAD_PLUGIN_URL . 'css/autoload-style.css',
            array(),
            DIVI_AUTOLOAD_VERSION.time(),
        );
        
        // Add inline CSS for customization
        $custom_css = $this->get_custom_css();
        wp_add_inline_style('divi-autoload-next-post-style', $custom_css);
    }

    /**
     * Dequeue Easy Table of Contents front.js and load bundled toc-custom.js instead.
     * Re-registers the eztoc-js handle so wp_localize_script output (ezTOC) is preserved.
     */
    public function replace_eztoc_script_with_custom() {
        if (!isset($this->options['enable_plugin']) || $this->options['enable_plugin'] != '1') {
            return;
        }
        if (!is_single() || !is_singular('post')) {
            return;
        }
        if (!wp_script_is('eztoc-js', 'enqueued')) {
            return;
        }

        global $wp_scripts;
        if (!($wp_scripts instanceof WP_Scripts) || !isset($wp_scripts->registered['eztoc-js'])) {
            return;
        }

        $l10n = $wp_scripts->get_data('eztoc-js', 'data');
        $deps = array('jquery', 'eztoc-js-cookie', 'eztoc-jquery-sticky-kit');
        if (wp_script_is('eztoc-scroll-scriptjs', 'enqueued')) {
            $deps[] = 'eztoc-scroll-scriptjs';
        }

        $toc_custom_path = DIVI_AUTOLOAD_PLUGIN_DIR . 'js/toc-custom.js';
        $toc_custom_ver  = DIVI_AUTOLOAD_VERSION;
        if (file_exists($toc_custom_path)) {
            $toc_custom_ver .= '.' . filemtime($toc_custom_path);
        }

        wp_dequeue_script('eztoc-js');
        wp_deregister_script('eztoc-js');
        wp_register_script(
            'eztoc-js',
            DIVI_AUTOLOAD_PLUGIN_URL . 'js/toc-custom.js',
            $deps,
            $toc_custom_ver,
            true
        );
        wp_enqueue_script('eztoc-js');
        if ($l10n) {
            $wp_scripts->add_data('eztoc-js', 'data', $l10n);
        }
    }
    
    /**
     * Generate custom CSS based on settings
     */
    private function get_custom_css() {
        $main_size = isset($this->options['main_button_size']) ? $this->options['main_button_size'] : 60;
        $nav_size = isset($this->options['nav_button_size']) ? $this->options['nav_button_size'] : 18;
        $main_color = isset($this->options['main_button_color']) ? $this->options['main_button_color'] : '#667eea';
        $top_color = isset($this->options['top_button_color']) ? $this->options['top_button_color'] : '#48c6ef';
        $bottom_color = isset($this->options['bottom_button_color']) ? $this->options['bottom_button_color'] : '#f093fb';
        $button_position = isset($this->options['button_position']) ? $this->options['button_position'] : 'bottom-right';
        $show_top_button = isset($this->options['show_top_button']) ? $this->options['show_top_button'] : '1';
        $show_bottom_button = isset($this->options['show_bottom_button']) ? $this->options['show_bottom_button'] : '1';
        
        // Calculate positions for centered alignment
        $main_center = 50 + ($main_size / 2);
        $nav_position = $main_center - ($nav_size / 2);
        
        // Hide buttons if disabled
        $visibility_css = '';
        if ($show_top_button !== '1') {
            $visibility_css .= ".autoload-goto-top-button { display: none !important; }\n";
        }
        if ($show_bottom_button !== '1') {
            $visibility_css .= ".autoload-goto-bottom-button { display: none !important; }\n";
        }
        
        // Position-specific CSS
        $position_css = '';
        switch ($button_position) {
            case 'bottom-left':
                $position_css = "
                .autoload-floating-button {
                    left: 50px;
                    right: auto;
                }
                .autoload-goto-top-button {
                    left: {$nav_position}px;
                    right: auto;
                }
                .autoload-goto-bottom-button {
                    left: {$nav_position}px;
                    right: auto;
                }
                .autoload-reading-widget {
                    left: 30px;
                    right: auto;
                }
                ";
                break;
            case 'bottom-center':
                $position_css = "
                .autoload-floating-button {
                    left: 50%;
                    right: auto;
                    transform: translateX(-50%);
                }
                .autoload-floating-button.visible {
                    transform: translateX(-50%) scale(1);
                }
                .autoload-floating-button:hover {
                    transform: translateX(-50%) scale(1.1);
                }
                .autoload-goto-top-button {
                    left: 50%;
                    right: auto;
                    transform: translateX(-50%) scale(0.8) translateY(10px);
                    margin-left: 0;
                }
                .autoload-goto-top-button.visible {
                    transform: translateX(-50%) scale(1) translateY(0);
                }
                .autoload-goto-top-button:hover {
                    transform: translateX(-50%) scale(1.5) translateY(0);
                }
                .autoload-goto-bottom-button {
                    left: 50%;
                    right: auto;
                    transform: translateX(-50%) scale(0.8) translateY(-10px);
                    margin-left: 0;
                }
                .autoload-goto-bottom-button.visible {
                    transform: translateX(-50%) scale(1) translateY(0);
                }
                .autoload-goto-bottom-button:hover {
                    transform: translateX(-50%) scale(1.5) translateY(0);
                }
                .autoload-reading-widget {
                    left: 50%;
                    right: auto;
                    transform: translateX(-50%) translateY(calc(100% + 40px));
                }
                .autoload-reading-widget.open {
                    transform: translateX(-50%) translateY(0);
                }
                ";
                break;
            default: // bottom-right
                // No additional CSS needed, already in base CSS
                break;
        }
        
        $css = "
        .autoload-floating-button {
            width: {$main_size}px;
            height: {$main_size}px;
            background: {$main_color};
        }
        .autoload-goto-top-button {
            width: {$nav_size}px;
            height: {$nav_size}px;
            background: {$top_color};
            right: {$nav_position}px;
        }
        .autoload-goto-bottom-button {
            width: {$nav_size}px;
            height: {$nav_size}px;
            background: {$bottom_color};
            right: {$nav_position}px;
        }
        .autoload-reading-widget {
            background: {$main_color};
        }
        {$position_css}
        {$visibility_css}
        ";
        
        return $css;
    }
    
    /**
     * AJAX handler to get next post ID
     */
    public function ajax_get_next_post_id() {
        $ajax_handler = new Divi_Auto_Load_Ajax_Handler();
        $ajax_handler->get_next_post_id();
    }
    
    /**
     * Add comments toggle button
     */
    public function comments_toggle_button() {
        // Check if plugin is enabled
        if (!isset($this->options['enable_plugin']) || $this->options['enable_plugin'] != '1') {
            return;
        }
        
        // Check if comments toggle should be shown
        if (!isset($this->options['show_comments_toggle']) || $this->options['show_comments_toggle'] != '1') {
            return;
        }
        
        global $post;
        echo '<div class="comment-section-toggle">
        <a class="et_pb_button comment-section-toggle-button" post_id="' . esc_attr($post->ID) . '">Show / Hide Comments</a></div>';
    }  
}

// Initialize the plugin
function divi_autoload_init() {
    new Divi_Auto_Load_Next_Post();
}
add_action('plugins_loaded', 'divi_autoload_init');