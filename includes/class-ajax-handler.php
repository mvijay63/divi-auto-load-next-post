<?php
/**
 * AJAX Handler Class
 * Handles all AJAX requests
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

class Divi_Auto_Load_Ajax_Handler {

    /**
     * Get next post ID (cyclic — wraps around to the newest post after the last one)
     */
    public function get_next_post_id() {
        check_ajax_referer('divi_autoload_nonce', 'nonce');
        
        $current_post_id = isset($_POST['post_id']) ? intval($_POST['post_id']) : 0;
        
        if (!$current_post_id) {
            wp_send_json_error('Invalid post ID');
        }
        
        // Get the current post
        $current_post = get_post($current_post_id);
        
        if (!$current_post) {
            wp_send_json_error('Post not found');
        }

        $options = get_option('divi_autoload_settings');

        // Build shared base args
        $base_args = array(
            'post_type'      => $current_post->post_type,
            'posts_per_page' => 1,
            'post_status'    => 'publish',
            'post__not_in'   => array($current_post_id),
            'orderby'        => 'date',
            'order'          => 'DESC',
        );

        // Restrict to same category if enabled
        if (isset($options['enable_same_category']) && $options['enable_same_category'] == '1') {
            $categories = wp_get_post_categories($current_post_id);
            if (!empty($categories)) {
                $base_args['category__in'] = $categories;
            }
        }

        // --- Step 1: Try to find the chronologically previous post (older than current) ---
        $next_args = array_merge($base_args, array(
            'date_query' => array(
                array(
                    'before'    => $current_post->post_date,
                    'inclusive' => false,
                ),
            ),
        ));

        $next_posts = new WP_Query($next_args);

        if ($next_posts->have_posts()) {
            // Normal case — a older post exists
            $next_post = $next_posts->posts[0];
            wp_reset_postdata();

            $scoped_css = $this->fetch_and_scope_external_css($next_post->ID);

            wp_send_json_success(array(
                'post_id'    => $next_post->ID,
                'post_url'   => get_permalink($next_post->ID),
                'post_title' => get_the_title($next_post->ID),
                'scoped_css' => $scoped_css,
                'cyclic'     => false,
            ));

        } else {
            // --- Step 2: No older post found — wrap around to the newest post (cyclic) ---
            wp_reset_postdata();

            $wrap_args = array_merge($base_args, array(
                // No date_query — fetch the newest published post excluding current
                'order' => 'DESC',
            ));

            $wrap_posts = new WP_Query($wrap_args);

            if ($wrap_posts->have_posts()) {
                $next_post = $wrap_posts->posts[0];
                wp_reset_postdata();

                $scoped_css = $this->fetch_and_scope_external_css($next_post->ID);

                wp_send_json_success(array(
                    'post_id'    => $next_post->ID,
                    'post_url'   => get_permalink($next_post->ID),
                    'post_title' => get_the_title($next_post->ID),
                    'scoped_css' => $scoped_css,
                    'cyclic'     => true, // flag so JS knows we wrapped around
                ));

            } else {
                // Only one post exists in the system — nothing to cycle to
                wp_reset_postdata();
                wp_send_json_error('Only one post exists');
            }
        }
    }
    
    /**
     * Fetch and scope external CSS files for a post
     */
    private function fetch_and_scope_external_css($post_id) {
        $post_url = get_permalink($post_id);
        $response = wp_remote_get($post_url);
        
        if (is_wp_error($response)) {
            return '';
        }
        
        $html = wp_remote_retrieve_body($response);
        $scoped_css = '';
        
        // Extract link tags with et-cache or et-divi-dynamic in URL
        preg_match_all('/<link[^>]*rel=["\']stylesheet["\'][^>]*>/i', $html, $link_matches);
        
        if (!empty($link_matches[0])) {
            foreach ($link_matches[0] as $link_tag) {
                // Extract href
                if (preg_match('/href=["\']([^"\']+)["\']/', $link_tag, $href_match)) {
                    $css_url = $href_match[1];
                    
                    // Only process et-cache and divi-dynamic CSS files
                    if (strpos($css_url, 'et-cache') !== false || strpos($css_url, 'divi-dynamic') !== false) {
                        // Fetch the CSS file
                        $css_response = wp_remote_get($css_url);
                        
                        if (!is_wp_error($css_response)) {
                            $css_content = wp_remote_retrieve_body($css_response);
                            
                            // Scope the CSS
                            $scoped = $this->scope_css_with_post_id($css_content, $post_id);
                            $scoped_css .= $scoped . "\n";
                        }
                    }
                }
            }
        }
        
        return $scoped_css;
    }
    
    /**
     * Scope CSS selectors with post ID suffix
     */
    private function scope_css_with_post_id($css, $post_id) {
        $post_suffix = '_post_' . $post_id;
        
        // Replace Divi class selectors: .et_pb_something → .et_pb_something_post_27
        $css = preg_replace('/\.et_pb_([a-zA-Z0-9_-]+)/', '.et_pb_$1' . $post_suffix, $css);
        
        // Replace Divi ID selectors: #et_pb_something → #et_pb_something_post_27
        $css = preg_replace('/#et_pb_([a-zA-Z0-9_-]+)/', '#et_pb_$1' . $post_suffix, $css);
        
        // Replace et- prefixed classes: .et-something → .et-something_post_27
        $css = preg_replace('/\.et-([a-zA-Z0-9_-]+)/', '.et-$1' . $post_suffix, $css);
        
        // Replace et- prefixed IDs: #et-something → #et-something_post_27
        $css = preg_replace('/#et-([a-zA-Z0-9_-]+)/', '#et-$1' . $post_suffix, $css);
        
        return $css;
    }
}