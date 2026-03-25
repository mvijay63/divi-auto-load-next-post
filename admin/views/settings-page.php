<?php
/**
 * Settings Page View
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

$admin_url = admin_url('options-general.php?page=divi-autoload-settings');
$options = get_option('divi_autoload_settings');

// Safely get all values with defaults
$enable_plugin = isset($options['enable_plugin']) ? $options['enable_plugin'] : '1';
$enable_same_category = isset($options['enable_same_category']) ? $options['enable_same_category'] : '0';
$scroll_trigger = isset($options['scroll_trigger']) ? $options['scroll_trigger'] : '30';
$widget_auto_close = isset($options['widget_auto_close']) ? $options['widget_auto_close'] : '300';
$button_position = isset($options['button_position']) ? $options['button_position'] : 'bottom-right';
$main_button_size = isset($options['main_button_size']) ? $options['main_button_size'] : '60';
$nav_button_size = isset($options['nav_button_size']) ? $options['nav_button_size'] : '18';
$main_button_color = isset($options['main_button_color']) ? $options['main_button_color'] : '#667eea';
$top_button_color = isset($options['top_button_color']) ? $options['top_button_color'] : '#48c6ef';
$bottom_button_color = isset($options['bottom_button_color']) ? $options['bottom_button_color'] : '#f093fb';
$show_progress = isset($options['show_progress']) ? $options['show_progress'] : '1';
$show_top_button = isset($options['show_top_button']) ? $options['show_top_button'] : '1';
$show_bottom_button = isset($options['show_bottom_button']) ? $options['show_bottom_button'] : '1';
$show_comments_toggle = isset($options['show_comments_toggle']) ? $options['show_comments_toggle'] : '1';
?>

<div class="wrap divi-autoload-settings-wrap">
    <h1>Divi Auto Load Next Post Settings</h1>
    
    <form method="post" action="options.php">
        <?php settings_fields('divi_autoload_settings_group'); ?>
        
        <!-- Tabs Navigation -->
        <div class="divi-autoload-tabs">
            <a href="<?php echo $admin_url.'&section=general' ;?>" type="button" class="divi-autoload-tab active" data-tab="general">
                General
            </a>
            <a href="<?php echo $admin_url.'&section=appearance' ;?>" type="button" class="divi-autoload-tab" data-tab="appearance">
                Appearance
            </a>
            <a href="<?php echo $admin_url.'&section=features' ;?>" type="button" class="divi-autoload-tab" data-tab="features">
                Features
            </a>
        </div>
        
        <!-- General Tab -->
        <div class="divi-autoload-tab-content active" id="tab-general">
            <div class="divi-autoload-card">
                <div class="divi-autoload-card-header">
                    <h2>General Settings</h2>
                    <p>Configure the basic behavior of the auto-load feature.</p>
                </div>
                <div class="divi-autoload-card-body">
                    <table class="form-table divi-autoload-form-table">
                        <tr>
                            <th>Enable Auto Load</th>
                            <td>
                                <label class="divi-autoload-switch">
                                    <input type="checkbox" name="divi_autoload_settings[enable_plugin]" value="1" <?php checked('1', $enable_plugin); ?> />
                                    <span class="divi-autoload-slider"></span>
                                </label>
                                <p class="description">Enable or disable the auto-load next post feature.</p>
                            </td>
                        </tr>
                        <tr>
                            <th>Load Same Category Posts</th>
                            <td>
                                <label class="divi-autoload-switch">
                                    <input type="checkbox" name="divi_autoload_settings[enable_same_category]" value="1" <?php checked('1', $enable_same_category); ?> />
                                    <span class="divi-autoload-slider"></span>
                                </label>
                                <p class="description">Enable or disable load posts from the same category.</p>
                            </td>
                        </tr>
                        <tr>
                            <th>Scroll Trigger (%)</th>
                            <td>
                                <div class="divi-autoload-range-wrap">
                                    <input type="range" name="divi_autoload_settings[scroll_trigger]" value="<?php echo esc_attr($scroll_trigger); ?>" min="10" max="90" step="5" class="divi-autoload-range" oninput="this.nextElementSibling.value = this.value" />
                                    <span class="divi-autoload-range-value"><?php echo esc_attr($scroll_trigger); ?></span>
                                    <span class="divi-autoload-range-unit">%</span>
                                </div>
                                <p class="description">Percentage of post scrolled before loading next post (10-90%).</p>
                            </td>
                        </tr>
                        <tr>
                            <th>Widget Auto Close (px)</th>
                            <td>
                                <div class="divi-autoload-range-wrap">
                                    <input type="range" name="divi_autoload_settings[widget_auto_close]" value="<?php echo esc_attr($widget_auto_close); ?>" min="100" max="1000" step="50" class="divi-autoload-range" oninput="this.nextElementSibling.value = this.value" />
                                    <span class="divi-autoload-range-value"><?php echo esc_attr($widget_auto_close); ?></span>
                                    <span class="divi-autoload-range-unit">px</span>
                                </div>
                                <p class="description">Scroll distance before widget closes automatically.</p>
                            </td>
                        </tr>
                    </table>
                </div>
            </div>
        </div>
        
        <!-- Appearance Tab -->
        <div class="divi-autoload-tab-content" id="tab-appearance">
            <div class="divi-autoload-card">
                <div class="divi-autoload-card-header">
                    <h2>Appearance Settings</h2>
                    <p>Customize the look and feel of the navigation buttons.</p>
                </div>
                <div class="divi-autoload-card-body">
                    <div class="divi-autoload-appearance-layout">
                        <div class="divi-autoload-appearance-settings">
                            <table class="form-table divi-autoload-form-table">
                                <tr>
                                    <th>Button Position</th>
                                    <td>
                                        <div class="divi-autoload-position-options">
                                            <label class="divi-autoload-position-option <?php echo ($button_position === 'bottom-left') ? 'active' : ''; ?>">
                                                <input type="radio" name="divi_autoload_settings[button_position]" value="bottom-left" <?php checked($button_position, 'bottom-left'); ?> />
                                                <div class="position-preview">
                                                    <div class="position-dot bottom-left"></div>
                                                </div>
                                                <span>Bottom Left</span>
                                            </label>
                                            <label class="divi-autoload-position-option <?php echo ($button_position === 'bottom-center') ? 'active' : ''; ?>">
                                                <input type="radio" name="divi_autoload_settings[button_position]" value="bottom-center" <?php checked($button_position, 'bottom-center'); ?> />
                                                <div class="position-preview">
                                                    <div class="position-dot bottom-center"></div>
                                                </div>
                                                <span>Bottom Center</span>
                                            </label>
                                            <label class="divi-autoload-position-option <?php echo ($button_position === 'bottom-right') ? 'active' : ''; ?>">
                                                <input type="radio" name="divi_autoload_settings[button_position]" value="bottom-right" <?php checked($button_position, 'bottom-right'); ?> />
                                                <div class="position-preview">
                                                    <div class="position-dot bottom-right"></div>
                                                </div>
                                                <span>Bottom Right</span>
                                            </label>
                                        </div>
                                    </td>
                                </tr>
                                <tr>
                                    <th>Main Button Size (px)</th>
                                    <td>
                                        <div class="divi-autoload-range-wrap">
                                            <input type="range" name="divi_autoload_settings[main_button_size]" value="<?php echo esc_attr($main_button_size); ?>" min="40" max="100" step="2" class="divi-autoload-range" oninput="this.nextElementSibling.value = this.value" />
                                            <span class="divi-autoload-range-value"><?php echo esc_attr($main_button_size); ?></span>
                                            <span class="divi-autoload-range-unit">px</span>
                                        </div>
                                        <p class="description">Size of the main progress button (40-100px).</p>
                                    </td>
                                </tr>
                                <tr>
                                    <th>Navigation Button Size (px)</th>
                                    <td>
                                        <div class="divi-autoload-range-wrap">
                                            <input type="range" name="divi_autoload_settings[nav_button_size]" value="<?php echo esc_attr($nav_button_size); ?>" min="12" max="40" step="2" class="divi-autoload-range" oninput="this.nextElementSibling.value = this.value" />
                                            <span class="divi-autoload-range-value"><?php echo esc_attr($nav_button_size); ?></span>
                                            <span class="divi-autoload-range-unit">px</span>
                                        </div>
                                        <p class="description">Size of the navigation buttons (12-40px).</p>
                                    </td>
                                </tr>
                                <tr>
                                    <th>Colors</th>
                                    <td>
                                        <div class="divi-autoload-color-row">
                                            <div class="divi-autoload-color-item">
                                                <input type="color" name="divi_autoload_settings[main_button_color]" value="<?php echo esc_attr($main_button_color); ?>" />
                                                <span>Main</span>
                                            </div>
                                            <div class="divi-autoload-color-item">
                                                <input type="color" name="divi_autoload_settings[top_button_color]" value="<?php echo esc_attr($top_button_color); ?>" />
                                                <span>Top</span>
                                            </div>
                                            <div class="divi-autoload-color-item">
                                                <input type="color" name="divi_autoload_settings[bottom_button_color]" value="<?php echo esc_attr($bottom_button_color); ?>" />
                                                <span>Bottom</span>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            </table>
                        </div>
                        <div class="divi-autoload-appearance-preview">
                            <div class="divi-autoload-preview-box">
                                <h3>Live Preview</h3>
                                <div class="preview-stack">
                                    <div class="preview-nav-button" style="width:<?php echo esc_attr($nav_button_size); ?>px; height:<?php echo esc_attr($nav_button_size); ?>px; background:<?php echo esc_attr($top_button_color); ?>;">↑</div>
                                    <div class="preview-main-button" style="width:<?php echo esc_attr($main_button_size); ?>px; height:<?php echo esc_attr($main_button_size); ?>px; background:<?php echo esc_attr($main_button_color); ?>;">50%</div>
                                    <div class="preview-nav-button" style="width:<?php echo esc_attr($nav_button_size); ?>px; height:<?php echo esc_attr($nav_button_size); ?>px; background:<?php echo esc_attr($bottom_button_color); ?>;">↓</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Features Tab -->
        <div class="divi-autoload-tab-content" id="tab-features">
            <div class="divi-autoload-card">
                <div class="divi-autoload-card-header">
                    <h2>Features</h2>
                    <p>Enable or disable specific features.</p>
                </div>
                <div class="divi-autoload-card-body">
                    <table class="form-table divi-autoload-form-table">
                        <tr>
                            <th>Progress Widget</th>
                            <td>
                                <label class="divi-autoload-switch">
                                    <input type="checkbox" name="divi_autoload_settings[show_progress]" value="1" <?php checked('1', $show_progress); ?> />
                                    <span class="divi-autoload-slider"></span>
                                </label>
                                <p class="description">Show the reading progress widget.</p>
                            </td>
                        </tr>
                        <tr>
                            <th>Top Navigation Button</th>
                            <td>
                                <label class="divi-autoload-switch">
                                    <input type="checkbox" name="divi_autoload_settings[show_top_button]" value="1" <?php checked('1', $show_top_button); ?> />
                                    <span class="divi-autoload-slider"></span>
                                </label>
                                <p class="description">Show the "Go to Top" navigation button.</p>
                            </td>
                        </tr>
                        <tr>
                            <th>Bottom Navigation Button</th>
                            <td>
                                <label class="divi-autoload-switch">
                                    <input type="checkbox" name="divi_autoload_settings[show_bottom_button]" value="1" <?php checked('1', $show_bottom_button); ?> />
                                    <span class="divi-autoload-slider"></span>
                                </label>
                                <p class="description">Show the "Go to Bottom/Next" navigation button.</p>
                            </td>
                        </tr>
                        <tr>
                            <th>Comments Toggle</th>
                            <td>
                                <label class="divi-autoload-switch">
                                    <input type="checkbox" name="divi_autoload_settings[show_comments_toggle]" value="1" <?php checked('1', $show_comments_toggle); ?> />
                                    <span class="divi-autoload-slider"></span>
                                </label>
                                <p class="description">Show the comments toggle button on posts.</p>
                            </td>
                        </tr>
                    </table>
                </div>
            </div>
        </div>
        
        <?php submit_button('Save Settings', 'primary', 'submit', true, array('class' => 'divi-autoload-save-button')); ?>
    </form>
</div>