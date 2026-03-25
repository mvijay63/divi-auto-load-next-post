(function($) {
    'use strict';
    
    let isLoading = false;
    let loadedPosts = [];
    let currentPostId = diviAutoLoad.currentPostId;
    let scrollStartedPosts = {}; // Track which posts have triggered scroll
    let $readingWidget = null;
    let $widgetProgressFill = null;
    let $floatingButton = null;
    let $goToTopButton = null;
    let $goToBottomButton = null;
    let isWidgetOpen = true; // Start in open mode
    let loadedAllPosts = false;
    
    // Get settings from localized data
    const settings = diviAutoLoad.settings || {};
    const scrollTrigger = parseInt(settings.scrollTrigger) || 30;
    const widgetAutoClose = parseInt(settings.widgetAutoClose) || 300;
    const showProgress = settings.showProgress === '1';
    const showTopButton = settings.showTopButton === '1';
    const showBottomButton = settings.showBottomButton === '1';
    
    // Initialize with current post
    const $initialElement = $('.et_pb_post, article.post').first();
    
    // Get initial excerpt
    const initialExcerpt = getPostExcerpt($initialElement);
    
    loadedPosts.push({
        id: currentPostId,
        url: window.location.href,
        title: document.title,
        excerpt: initialExcerpt,
        element: $initialElement
    });
    
    /**
     * Extract post excerpt from content
     */
    function getPostExcerpt($content) {
        if (!$content || !$content.length) return '';
        
        // Try to find excerpt or first paragraph
        let excerpt = $content.find('.entry-content p').first().text();
        
        if (!excerpt) {
            excerpt = $content.find('p').first().text();
        }
        
        if (!excerpt) {
            excerpt = $content.text();
        }
        
        // Clean and truncate
        excerpt = excerpt.trim();
        if (excerpt.length > 120) {
            excerpt = excerpt.substring(0, 120) + '...';
        }
        
        return excerpt;
    }
    
    /**
     * Create floating button
     */
    function createFloatingButton() {
        $floatingButton = $(`
            <button class="autoload-floating-button" aria-label="Reading Progress">
                <div class="button-progress-ring">
                    <svg class="progress-ring" width="60" height="60">
                        <circle class="progress-ring-circle" stroke="white" stroke-width="3" fill="transparent" r="27" cx="30" cy="30"/>
                    </svg>
                </div>
                <span class="button-percentage">0%</span>
            </button>
        `);
        
        $('body').append($floatingButton);
        
        // Click handler to toggle widget
        $floatingButton.on('click', function() {
            toggleWidget();
        });
    }
    
    /**
     * Create go to top button
     */
    function createGoToTopButton() {
        $goToTopButton = $(`
            <button class="autoload-goto-top-button" aria-label="Go to Top">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18"></path>
                </svg>
            </button>
        `);
        
        $('body').append($goToTopButton);
        
        // Click handler to scroll to top of current post
        $goToTopButton.on('click', function() {
            const visiblePost = getPostInViewport();
            if (visiblePost && visiblePost.element && visiblePost.element.length) {
                // $('html, body').animate({
                //     scrollTop: visiblePost.element.offset().top - 100
                // }, 600, 'swing');
                const currentIndex = loadedPosts.findIndex(p => p.id === visiblePost.id);
                console.log('currentIndex ', currentIndex);
                console.log('loadedPosts.length ', loadedPosts.length);
                // Check if there's a prev post
                if (currentIndex >= 0 && currentIndex <= loadedPosts.length - 1) {
                    const nextPost = loadedPosts[currentIndex - 1];
                    console.log('nextPost ', nextPost);

                    if (nextPost && nextPost.element && nextPost.element.length) {
                        // Scroll to top of next post
                        $('html, body').animate({
                            scrollTop: nextPost.element.offset().top - 100
                        }, 600, 'swing');
                        return;
                    }
                }

                if(currentIndex == 0) {
                    $('html, body').animate({
                        scrollTop: visiblePost.element.offset().top - 100
                    }, 600, 'swing');
                }

            }
        });
    }
    
    /**
     * Create go to bottom button
     */
    function createGoToBottomButton() {
        $goToBottomButton = $(`
            <button class="autoload-goto-bottom-button" aria-label="Go to Next Post">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
                </svg>
            </button>
        `);
        
        $('body').append($goToBottomButton);
        
        // Click handler to scroll to bottom of current post / top of next post
        $goToBottomButton.on('click', function() {
            const visiblePost = getPostInViewport();
            if (visiblePost && visiblePost.element && visiblePost.element.length) {
                const currentIndex = loadedPosts.findIndex(p => p.id === visiblePost.id);
                
                // Check if there's a next post
                if (currentIndex >= 0 && currentIndex < loadedPosts.length - 1) {
                    const nextPost = loadedPosts[currentIndex + 1];
                    if (nextPost && nextPost.element && nextPost.element.length) {
                        // Scroll to top of next post
                        $('html, body').animate({
                            scrollTop: nextPost.element.offset().top - 100
                        }, 600, 'swing');
                        return;
                    }
                }
                
                // If no next post, scroll to bottom of current post
                const postBottom = visiblePost.element.offset().top + visiblePost.element.outerHeight();
                $('html, body').animate({
                    scrollTop: postBottom - $(window).height() + 200
                }, 600, 'swing');
            }
        });
    }
    
    /**
     * Create and initialize floating reading widget
     */
    function createReadingWidget() {
        $readingWidget = $(`
            <div class="autoload-reading-widget open">
                <button class="widget-close-btn" aria-label="Close">
                    <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
                <div class="widget-header">
                    <div class="widget-icon-wrapper">
                        <svg class="widget-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
                        </svg>
                    </div>
                    <h3 class="reading-post-title"></h3>
                </div>
                <p class="reading-post-excerpt"></p>
                <div class="widget-progress-section">
                    <div class="progress-header">
                        <span class="progress-label">Progress</span>
                        <span class="progress-percentage">0%</span>
                    </div>
                    <div class="progress-bar-mini">
                        <div class="progress-fill-mini"></div>
                    </div>
                </div>
            </div>
        `);
        
        $widgetProgressFill = $readingWidget.find('.progress-fill-mini');
        
        // Append to body
        $('body').append($readingWidget);
        
        // Close button handler
        $readingWidget.find('.widget-close-btn').on('click', function() {
            closeWidget();
        });
        
        console.log('Reading widget created');
    }
    
    /**
     * Toggle widget open/close
     */
    function toggleWidget() {
        if (isWidgetOpen) {
            closeWidget();
        } else {
            openWidget();
        }
    }
    
    /**
     * Open widget
     */
    function openWidget() {
        isWidgetOpen = true;
        $readingWidget.addClass('open');
        $floatingButton.removeClass('visible');
        if ($goToTopButton) {
            $goToTopButton.removeClass('visible');
        }
        if ($goToBottomButton) {
            $goToBottomButton.removeClass('visible');
        }
    }
    
    /**
     * Close widget
     */
    function closeWidget() {
        isWidgetOpen = false;
        $readingWidget.removeClass('open');
        
        // Show floating button and navigation buttons after widget closes (based on settings)
        setTimeout(function() {
            $floatingButton.addClass('visible');
            if (showTopButton && $goToTopButton) {
                $goToTopButton.addClass('visible');
            }
            if (showBottomButton && $goToBottomButton) {
                $goToBottomButton.addClass('visible');
            }
        }, 300);
    }
    
    /**
     * Update reading widget and button display
     */
    function updateReadingWidget() {
        if (!$readingWidget || !$floatingButton) return;
        
        const scrollTop = $(window).scrollTop();
        const visiblePost = getPostInViewport();
        
        // After scrolling past configured threshold, close widget and show button
        if (scrollTop > widgetAutoClose && isWidgetOpen) {
            closeWidget();
        }
        
        // Show/hide navigation buttons based on scroll position and settings
        if (scrollTop > widgetAutoClose && !isWidgetOpen) {
            if (showTopButton && $goToTopButton) {
                $goToTopButton.addClass('visible');
            }
            if (showBottomButton && $goToBottomButton) {
                $goToBottomButton.addClass('visible');
            }
        } else if (scrollTop <= widgetAutoClose) {
            if ($goToTopButton) {
                $goToTopButton.removeClass('visible');
            }
            if ($goToBottomButton) {
                $goToBottomButton.removeClass('visible');
            }
        }
        
        // Update content if there's a visible post
        if (visiblePost) {
            // Update title
            $readingWidget.find('.reading-post-title').text(visiblePost.title);
            $floatingButton.attr('title', visiblePost.title);
            
            // Update excerpt
            if (visiblePost.excerpt) {
                $readingWidget.find('.reading-post-excerpt').text(visiblePost.excerpt);
            }
            
            // Update progress percentage
            if (visiblePost.element && visiblePost.element.length) {
                const scrollPercentage = getScrollPercentage(visiblePost.element);
                const clampedPercentage = Math.min(Math.max(scrollPercentage, 0), 100);
                
                // Update widget progress
                $readingWidget.find('.progress-percentage').text(Math.round(clampedPercentage) + '%');
                $widgetProgressFill.css('width', clampedPercentage + '%');
                
                // Update button progress
                $floatingButton.find('.button-percentage').text(Math.round(clampedPercentage) + '%');
                updateProgressRing(clampedPercentage);
            }
        }
    }
    
    /**
     * Update circular progress ring on button
     */
    function updateProgressRing(percentage) {
        const circle = $floatingButton.find('.progress-ring-circle')[0];
        const radius = circle.r.baseVal.value;
        const circumference = radius * 2 * Math.PI;
        const offset = circumference - (percentage / 100) * circumference;
        
        circle.style.strokeDasharray = `${circumference} ${circumference}`;
        circle.style.strokeDashoffset = offset;
    }
    
    /**
     * Calculate scroll percentage for an article
     */
    function getScrollPercentage(article) {
        if (!article.length) return 0;
        
        const articleTop = article.offset().top;
        const articleHeight = article.outerHeight();
        const scrollTop = $(window).scrollTop();
        const windowHeight = $(window).height();
        
        const scrolled = scrollTop + windowHeight - articleTop;
        const percentage = (scrolled / articleHeight) * 100;
        
        return Math.min(Math.max(percentage, 0), 100);
    }
    
    /**
     * Check which post is currently in viewport
     */
    function getPostInViewport() {
        const scrollTop = $(window).scrollTop();
        const windowHeight = $(window).height();
        const viewportMiddle = scrollTop + (windowHeight / 2);
        
        let currentPost = null;
        let minDistance = Infinity;
        
        loadedPosts.forEach(function(post) {
            if (post.element && post.element.length) {
                const postTop = post.element.offset().top;
                const postHeight = post.element.outerHeight();
                const postMiddle = postTop + (postHeight / 2);
                const distance = Math.abs(viewportMiddle - postMiddle);
                
                if (viewportMiddle >= postTop && viewportMiddle <= postTop + postHeight) {
                    if (distance < minDistance) {
                        minDistance = distance;
                        currentPost = post;
                    }
                }
            }
        });
        
        return currentPost;
    }
    
    /**
     * Update URL based on visible post
     */
    function updateUrlForVisiblePost() {
        const visiblePost = getPostInViewport();
        
        if (visiblePost && visiblePost.url !== window.location.href) {
            if (history.replaceState) {
                history.replaceState(null, visiblePost.title, visiblePost.url);
                document.title = visiblePost.title;
            }
        }
    }
    
    /**
     * Handle scroll event - lightweight operations (progress, URL)
     */
    function handleScrollLight() {
        updateUrlForVisiblePost();
        updateReadingWidget(); // Update reading widget on scroll
    }
    
    /**
     * Handle scroll event - heavy operations (preload checks)
     */
    function handleScrollHeavy() {
        checkAndTriggerPreload();
        
        // Fallback loader at configured scroll trigger
        loadedPosts.forEach(function(post, index) {
            if (post.element && post.element.length) {
                const scrollPercentage = getScrollPercentage(post.element);
                
                if (index === loadedPosts.length - 1 && scrollPercentage >= scrollTrigger) {
                    const nextPostExists = loadedPosts.length > index + 1;
                    
                    if (!nextPostExists && !isLoading && !loadedAllPosts) {
                        preloadNextPost();
                    }
                }
            }
        });
    }
    
    /**
     * Scope CSS selectors with post ID suffix
     */
    function scopeCSSWithPostId(cssText, postId) {
        if (!cssText) return '';
        
        const postSuffix = '_post_' + postId;
        
        // Replace Divi class selectors: .et_pb_something → .et_pb_something_post_27
        cssText = cssText.replace(/\.et_pb_([a-zA-Z0-9_-]+)/g, '.et_pb_$1' + postSuffix);
        
        // Replace Divi ID selectors: #et_pb_something → #et_pb_something_post_27
        cssText = cssText.replace(/#et_pb_([a-zA-Z0-9_-]+)/g, '#et_pb_$1' + postSuffix);
        
        // Replace et- prefixed classes: .et-something → .et-something_post_27
        cssText = cssText.replace(/\.et-([a-zA-Z0-9_-]+)/g, '.et-$1' + postSuffix);
        
        return cssText;
    }
    
    /**
     * Scope HTML classes and IDs with post ID suffix
     */
    function scopeHTMLWithPostId(html, postId) {
        const postSuffix = '_post_' + postId;
        const $html = $('<div>').html(html);
        
        // Find all elements with et_pb_ or et- classes
        $html.find('[class*="et_pb_"], [class*="et-"]').each(function() {
            const $el = $(this);
            const classes = $el.attr('class');
            
            if (classes) {
                // Replace et_pb_ classes
                let newClasses = classes.replace(/\bet_pb_([a-zA-Z0-9_-]+)\b/g, 'et_pb_$1' + postSuffix);
                // Replace et- classes
                newClasses = newClasses.replace(/\bet-([a-zA-Z0-9_-]+)\b/g, 'et-$1' + postSuffix);
                
                $el.attr('class', newClasses);
            }
        });
        
        // Find all elements with et_pb_ or et- IDs
        $html.find('[id*="et_pb_"], [id*="et-"]').each(function() {
            const $el = $(this);
            const id = $el.attr('id');
            
            if (id) {
                // Replace et_pb_ IDs
                let newId = id.replace(/^et_pb_([a-zA-Z0-9_-]+)$/, 'et_pb_$1' + postSuffix);
                // Replace et- IDs
                newId = newId.replace(/^et-([a-zA-Z0-9_-]+)$/, 'et-$1' + postSuffix);
                
                $el.attr('id', newId);
            }
        });
        
        return $html.html();
    }
    
    /**
     * Extract and scope inline styles from HTML
     */
    function extractAndScopeStyles(html, postId) {
        const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
        
        if (!headMatch) return '';
        
        const headContent = headMatch[1];
        let allScopedCSS = '';
        
        // Extract all inline style tags
        const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
        let styleMatch;
        
        while ((styleMatch = styleRegex.exec(headContent)) !== null) {
            const cssContent = styleMatch[1];
            const scopedCSS = scopeCSSWithPostId(cssContent, postId);
            allScopedCSS += scopedCSS + '\n';
        }
        
        return allScopedCSS;
    }
    
    /**
     * Get next post ID via AJAX
     */
    function getNextPostId(postId) {
        return $.ajax({
            url: diviAutoLoad.ajaxUrl,
            type: 'POST',
            data: {
                action: 'get_next_post_id',
                post_id: postId,
                nonce: diviAutoLoad.nonce
            }
        });
    }
    
    /**
     * Fetch next post HTML
     */
    function fetchNextPostHtml(postUrl) {
        return $.ajax({
            url: postUrl,
            type: 'GET',
            dataType: 'html'
        });
    }
    
    /**
     * Extract post content from HTML
     */
    function extractPostContent(html) {
        const $html = $('<div>').html(html);
        
        let content = $html.find('.et_pb_post, article.post').first();
        
        if (!content.length) {
            content = $html.find('article').first();
        }
        
        if (!content.length) {
            content = $html.find('.entry-content').first();
        }
        
        return content;
    }
    
    /**
     * Check if post already loaded
     */
    function isPostLoaded(postId) {
        return loadedPosts.some(function(post) {
            return post.id === postId;
        });
    }
    
    /**
     * Load next post silently in background with scoped styles
     */
    function preloadNextPost(forceLoad) {
        if (isLoading) return;
        
        const lastPost = loadedPosts[loadedPosts.length - 1];
        
        if (!forceLoad) {
            const lastIndex = loadedPosts.findIndex(p => p.id === lastPost.id);
            if (lastIndex < loadedPosts.length - 1) {
                return;
            }
        }
        
        isLoading = true;
        
        // Show loading indicator
        const $loader = $('<div class="autoload-loader"><div class="spinner"></div><p>Processing next post...</p></div>');
        lastPost.element.after($loader);
        
        // Step 1: Get next post ID
        getNextPostId(lastPost.id)
        .done(function(response) {
            if (response.success && response.data.post_url) {
                const nextPostId = response.data.post_id;

                if (isPostLoaded(nextPostId)) {
                    $loader.remove();
                    isLoading = false;
                    return;
                }

                // Step 2: Fetch HTML of next post
                fetchNextPostHtml(response.data.post_url)
                .done(function(html) {
                    console.log('Processing post', nextPostId, '- scoping CSS and HTML...');

                    // Extract and scope inline CSS
                    const inlineScopedCSS = extractAndScopeStyles(html, nextPostId);

                    // Get external scoped CSS from PHP response
                    const externalScopedCSS = response.data.scoped_css || '';

                    // Combine both
                    const allScopedCSS = externalScopedCSS + '\n' + inlineScopedCSS;

                    // Extract content
                    const $content = extractPostContent(html);

                    if ($content.length) {
                        // Scope HTML classes and IDs
                        const scopedHTML = scopeHTMLWithPostId($content.prop('outerHTML'), nextPostId);
                        const $scopedContent = $(scopedHTML);

                        // Add separator (just HR, no text)
                        const $separator = $('<div class="autoload-separator"><hr></div>');

                        // Inject scoped CSS into head (permanent)
                        if (allScopedCSS) {
                            const $styleTag = $('<style type="text/css" data-post-id="' + nextPostId + '">' + allScopedCSS + '</style>');
                            $('head').append($styleTag);
                            console.log('Scoped CSS injected for post', nextPostId, '(external + inline)');
                        }

                        // Set initial opacity to 0 for fade-in
                        $scopedContent.css('opacity', '0');

                        // Append content
                        $loader.before($separator);
                        $separator.after($scopedContent);

                        // Trigger fade-in animation after a brief delay
                        setTimeout(function() {
                            $scopedContent.addClass('autoload-post-fadein');
                        }, 50);

                        // Extract excerpt for the new post
                        const postExcerpt = getPostExcerpt($scopedContent);

                        // Store loaded post info
                        loadedPosts.push({
                            id: nextPostId,
                            url: response.data.post_url,
                            title: response.data.post_title,
                            excerpt: postExcerpt,
                            element: $scopedContent
                        });

                        // Remove loader
                        $loader.fadeOut(function() {
                            $(this).remove();
                        });

                        isLoading = false;

                        // Trigger Divi animations if needed
                        if (typeof window.et_pb_init_modules === 'function') {
                            window.et_pb_init_modules();
                        }

                        console.log('Post', nextPostId, 'loaded successfully with scoped styles');
                    } else {
                        $loader.html('<p>Could not load next post.</p>').fadeOut(3000, function() {
                            $(this).remove();
                        });
                        isLoading = false;
                    }
                })
                .fail(function() {
                    $loader.html('<p>Error loading next post.</p>').fadeOut(3000, function() {
                        $(this).remove();
                    });
                    isLoading = false;
                });
            } else {
                if( response.data == 'No next post found' ) {
                    loadedAllPosts = true;
                }
                $loader.html('<p>No more posts to load.</p>').fadeOut(3000, function() {
                    $(this).remove();
                });
                isLoading = false;
            }
        })
        .fail(function() {
            $loader.html('<p>Error fetching next post.</p>').fadeOut(3000, function() {
                $(this).remove();
            });
            isLoading = false;
        });
    }

    /**
     * Check if user has started scrolling in a specific post
     */
    function checkAndTriggerPreload() {
        const visiblePost = getPostInViewport();

        if (visiblePost && !scrollStartedPosts[visiblePost.id]) {
            scrollStartedPosts[visiblePost.id] = true;

            const visibleIndex = loadedPosts.findIndex(p => p.id === visiblePost.id);
            const nextPostExists = visibleIndex >= 0 && visibleIndex < loadedPosts.length - 1;

            if (!nextPostExists && !isLoading && !loadedAllPosts) {
                preloadNextPost();
            }
        }
    }

    /**
     * Handle scroll event
     */
    function handleScroll() {
        checkAndTriggerPreload();
        updateUrlForVisiblePost();
        
        // Fallback loader at configured scroll trigger
        loadedPosts.forEach(function(post, index) {
            if (post.element && post.element.length) {
                const scrollPercentage = getScrollPercentage(post.element);
                console.log('scrollPercentage ', scrollPercentage);
                
                if (index === loadedPosts.length - 1 && scrollPercentage >= scrollTrigger) {
                    const nextPostExists = loadedPosts.length > index + 1;
                    
                    if (!nextPostExists && !isLoading && !loadedAllPosts) {
                        preloadNextPost();
                    }
                }
            }
        });
    }
    
    /**
     * Initialize
     */
    $(document).ready(function() {
        if (!$('body').hasClass('single-post') && !$('body').hasClass('single')) {
            return;
        }
        
        // Create reading widget and buttons only if enabled in settings
        if (showProgress) {
            createReadingWidget();
            createFloatingButton();
        }
        
        if (showTopButton) {
            createGoToTopButton();
        }
        
        if (showBottomButton) {
            createGoToBottomButton();
        }
        
        scrollStartedPosts[currentPostId] = true;
        
        // Preload next post on page load
        preloadNextPost(true);
        
        // Real-time scroll handling for progress bar and URL (no throttle)
        let ticking = false;
        $(window).on('scroll', function() {
            if (!ticking) {
                window.requestAnimationFrame(function() {
                    handleScrollLight();
                    ticking = false;
                });
                ticking = true;
            }
        });
        
        // Throttled scroll handling for preload checks (heavier operations)
        let scrollTimeout;
        $(window).on('scroll', function() {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(handleScrollHeavy, 200);
        });
        
        // Initial update
        handleScrollLight();
        handleScrollHeavy();

        jQuery(document).on('click', '.comment-section-toggle-button', function () {
            jQuery(this)
                .closest('.et_post_meta_wrapper')
                .find('#comment-wrap')
                .stop(true, true)   // prevents animation queue buildup
                .slideToggle(300);  // duration in ms
        });
    });
    
})(jQuery);