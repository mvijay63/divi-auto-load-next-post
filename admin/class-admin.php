<?php
/**
 * Admin Class
 * Handles all admin-related functionality
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

class Divi_Auto_Load_Admin {
    
    private $options;
    
    public function __construct() {
        $this->options = get_option('divi_autoload_settings');
        
        // Admin hooks
        add_action('admin_menu', array($this, 'add_admin_menu'));
        add_action('admin_init', array($this, 'register_settings'));
        add_action('admin_enqueue_scripts', array($this, 'enqueue_admin_styles'));

        add_filter(
                'plugin_action_links_' . plugin_basename( DIVI_AUTOLOAD_PLUGIN_FILE ),
                array( $this, 'add_action_links' )
        );
    }
    
    /**
     * Enqueue admin styles
     */
    public function enqueue_admin_styles($hook) {
        if ($hook !== 'settings_page_divi-autoload-settings') {
            return;
        }
        
        wp_enqueue_style('dashicons');
        
        wp_enqueue_style(
            'divi-autoload-admin-style',
            DIVI_AUTOLOAD_PLUGIN_URL . 'admin/css/admin-style.css',
            array('dashicons'),
            DIVI_AUTOLOAD_VERSION.time()
        );
        
        wp_enqueue_script(
            'divi-autoload-admin-script',
            DIVI_AUTOLOAD_PLUGIN_URL . 'admin/js/admin-script.js',
            array(),
            DIVI_AUTOLOAD_VERSION.time(),
            true
        );
    }
    
    /**
     * Add admin menu
     */
    public function add_admin_menu() {
        add_options_page(
            'Divi Auto Load Next Post Settings',
            'Auto Load Next Post',
            'manage_options',
            'divi-autoload-settings',
            array($this, 'settings_page')
        );
    }
    
    /**
     * Register settings
     */
    public function register_settings() {
        register_setting('divi_autoload_settings_group', 'divi_autoload_settings', array($this, 'sanitize_settings'));
    }
    
    /**
     * Sanitize settings
     */
    public function sanitize_settings($input) {
        $sanitized = array();
        
        // Checkbox fields
        $sanitized['enable_plugin'] = isset($input['enable_plugin']) ? '1' : '0';
        $sanitized['enable_same_category'] = isset($input['enable_same_category']) ? '1' : '0';
        $sanitized['show_progress'] = isset($input['show_progress']) ? '1' : '0';
        $sanitized['show_top_button'] = isset($input['show_top_button']) ? '1' : '0';
        $sanitized['show_bottom_button'] = isset($input['show_bottom_button']) ? '1' : '0';
        $sanitized['show_comments_toggle'] = isset($input['show_comments_toggle']) ? '1' : '0';
        
        // Number fields
        $sanitized['scroll_trigger'] = isset($input['scroll_trigger']) ? min(max(absint($input['scroll_trigger']), 10), 90) : 30;
        $sanitized['widget_auto_close'] = isset($input['widget_auto_close']) ? min(max(absint($input['widget_auto_close']), 100), 1000) : 300;
        $sanitized['main_button_size'] = isset($input['main_button_size']) ? min(max(absint($input['main_button_size']), 40), 100) : 60;
        $sanitized['nav_button_size'] = isset($input['nav_button_size']) ? min(max(absint($input['nav_button_size']), 12), 40) : 18;
        
        // Color fields
        $sanitized['main_button_color'] = isset($input['main_button_color']) ? sanitize_hex_color($input['main_button_color']) : '#667eea';
        $sanitized['top_button_color'] = isset($input['top_button_color']) ? sanitize_hex_color($input['top_button_color']) : '#48c6ef';
        $sanitized['bottom_button_color'] = isset($input['bottom_button_color']) ? sanitize_hex_color($input['bottom_button_color']) : '#f093fb';
        
        // Select field
        $allowed_positions = array('bottom-left', 'bottom-center', 'bottom-right');
        $sanitized['button_position'] = isset($input['button_position']) && in_array($input['button_position'], $allowed_positions) ? $input['button_position'] : 'bottom-right';
        
        return $sanitized;
    }
    
    /**
     * Settings page
     */
    public function settings_page() {
        include_once DIVI_AUTOLOAD_PLUGIN_DIR . 'admin/views/settings-page.php';
    }

    /**
     * Adds a "Settings" link to the plugin row on the Plugins page.
     *
     * @param  array $links  Existing action links.
     * @return array         Modified action links.
     */
    public function add_action_links( $links ) {
        $settings_link = sprintf(
            '<a href="%s">%s</a>',
            esc_url( admin_url( 'options-general.php?page=divi-autoload-settings' ) ),
            esc_html__( 'Settings', 'divi-autoload' )
        );

        $links[] = $settings_link;

        return $links;
    }
}