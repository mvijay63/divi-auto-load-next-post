(function($) {
    'use strict';
    
    let isLoading = false;
    let loadedPosts = [];
    let currentPostId = diviAutoLoad.currentPostId;
    let loadInstanceCounter = 0; // Unique instance index for each appended post (including repeats)
    let scrollStartedInstances = {}; // Keyed by instance index, not post ID
    let $readingWidget = null;
    let $widgetProgressFill = null;
    let $floatingButton = null;
    let $goToTopButton = null;
    let $goToBottomButton = null;
    let isWidgetOpen = true; // Start in open mode
    // NOTE: loadedAllPosts removed — loading is now cyclic and never truly ends
    
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
        instance: loadInstanceCounter++, // unique index for this DOM entry
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
        
        let excerpt = $content.find('.entry-content p').first().text();
        
        if (!excerpt) {
            excerpt = $content.find('p').first().text();
        }
        
        if (!excerpt) {
            excerpt = $content.text();
        }
        
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
        
        $goToTopButton.on('click', function() {
            const visiblePost = getPostInViewport();
            if (visiblePost && visiblePost.element && visiblePost.element.length) {
                const currentIndex = loadedPosts.findIndex(p => p.instance === visiblePost.instance);

                if (currentIndex > 0) {
                    const prevPost = loadedPosts[currentIndex - 1];
                    if (prevPost && prevPost.element && prevPost.element.length) {
                        $('html, body').animate({
                            scrollTop: prevPost.element.offset().top - 100
                        }, 600, 'swing');
                        return;
                    }
                }

                // Already at the first loaded post — scroll to its top
                $('html, body').animate({
                    scrollTop: visiblePost.element.offset().top - 100
                }, 600, 'swing');
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
        
        $goToBottomButton.on('click', function() {
            const visiblePost = getPostInViewport();
            if (visiblePost && visiblePost.element && visiblePost.element.length) {
                const currentIndex = loadedPosts.findIndex(p => p.instance === visiblePost.instance);

                if (currentIndex >= 0 && currentIndex < loadedPosts.length - 1) {
                    const nextPost = loadedPosts[currentIndex + 1];
                    if (nextPost && nextPost.element && nextPost.element.length) {
                        $('html, body').animate({
                            scrollTop: nextPost.element.offset().top - 100
                        }, 600, 'swing');
                        return;
                    }
                }

                // No next post loaded yet — scroll to bottom of current post
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
        
        $('body').append($readingWidget);
        
        $readingWidget.find('.widget-close-btn').on('click', function() {
            closeWidget();
        });
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
        
        if (scrollTop > widgetAutoClose && isWidgetOpen) {
            closeWidget();
        }
        
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
        
        if (visiblePost) {
            $readingWidget.find('.reading-post-title').text(visiblePost.title);
            $floatingButton.attr('title', visiblePost.title);
            
            if (visiblePost.excerpt) {
                $readingWidget.find('.reading-post-excerpt').text(visiblePost.excerpt);
            }
            
            if (visiblePost.element && visiblePost.element.length) {
                const scrollPercentage = getScrollPercentage(visiblePost.element);
                const clampedPercentage = Math.min(Math.max(scrollPercentage, 0), 100);
                
                $readingWidget.find('.progress-percentage').text(Math.round(clampedPercentage) + '%');
                $widgetProgressFill.css('width', clampedPercentage + '%');
                
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
        updateReadingWidget();
    }
    
    /**
     * Handle scroll event - heavy operations (preload checks)
     */
    function handleScrollHeavy() {
        checkAndTriggerPreload();
        
        loadedPosts.forEach(function(post, index) {
            if (post.element && post.element.length) {
                const scrollPercentage = getScrollPercentage(post.element);
                
                if (index === loadedPosts.length - 1 && scrollPercentage >= scrollTrigger) {
                    const nextPostExists = loadedPosts.length > index + 1;
                    
                    if (!nextPostExists && !isLoading) {
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
        
        cssText = cssText.replace(/\.et_pb_([a-zA-Z0-9_-]+)/g, '.et_pb_$1' + postSuffix);
        cssText = cssText.replace(/#et_pb_([a-zA-Z0-9_-]+)/g, '#et_pb_$1' + postSuffix);
        cssText = cssText.replace(/\.et-([a-zA-Z0-9_-]+)/g, '.et-$1' + postSuffix);
        
        return cssText;
    }
    
    /**
     * Scope HTML classes and IDs with post ID suffix
     */
    function scopeHTMLWithPostId(html, postId) {
        const postSuffix = '_post_' + postId;
        const $html = $('<div>').html(html);
        
        $html.find('[class*="et_pb_"], [class*="et-"]').each(function() {
            const $el = $(this);
            const classes = $el.attr('class');
            
            if (classes) {
                let newClasses = classes.replace(/\bet_pb_([a-zA-Z0-9_-]+)\b/g, 'et_pb_$1' + postSuffix);
                newClasses = newClasses.replace(/\bet-([a-zA-Z0-9_-]+)\b/g, 'et-$1' + postSuffix);
                $el.attr('class', newClasses);
            }
        });
        
        $html.find('[id*="et_pb_"], [id*="et-"]').each(function() {
            const $el = $(this);
            const id = $el.attr('id');
            
            if (id) {
                let newId = id.replace(/^et_pb_([a-zA-Z0-9_-]+)$/, 'et_pb_$1' + postSuffix);
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
     * Check if the given post ID is the same as the very last loaded post.
     * We only block back-to-back duplicates — cyclic repeats further up are fine.
     */
    function isLastPostDuplicate(postId) {
        if (loadedPosts.length === 0) return false;
        return loadedPosts[loadedPosts.length - 1].id === postId;
    }
    
    /**
     * Load next post silently in background with scoped styles.
     * Cyclic: after the last post, wraps back to the first/newest post.
     */
    function preloadNextPost(forceLoad) {
        if (isLoading) return;
        
        const lastPost = loadedPosts[loadedPosts.length - 1];
        
        if (!forceLoad) {
            const lastIndex = loadedPosts.findIndex(p => p.instance === lastPost.instance);
            if (lastIndex < loadedPosts.length - 1) {
                return;
            }
        }
        
        isLoading = true;
        
        const $loader = $('<div class="autoload-loader"><div class="spinner"></div><p>Processing next post...</p></div>');
        lastPost.element.after($loader);
        
        // Step 1: Get next post ID (server will wrap around cyclically)
        getNextPostId(lastPost.id)
        .done(function(response) {
            if (response.success && response.data.post_url) {
                const nextPostId = response.data.post_id;
                const isCyclic = response.data.cyclic || false;

                // Single-post blog edge case — last post IS the next post, nothing to do
                if (isLastPostDuplicate(nextPostId)) {
                    $loader.remove();
                    isLoading = false;
                    return;
                }

                // --- CYCLIC: physically move the existing DOM element to the bottom ---
                if (isCyclic) {
                    console.log('isCyclic - ', isCyclic);
                    const existingIndex = loadedPosts.findIndex(p => p.id == nextPostId);
                    console.log('existingIndex - ', existingIndex);
                    console.log('loadedPosts - ', loadedPosts);

                    if (existingIndex !== -1) {
                        const existingEntry = loadedPosts[existingIndex];

                        // Remove the separator immediately before this element (if any)
                        existingEntry.element.prev('.autoload-separator').remove();

                        // Detach post element from its current DOM position
                        existingEntry.element.detach();

                        // Build separator with cyclic label and reinsert element after it
                        const $separator = $('<div class="autoload-separator"><hr><p style="text-align:center;color:#9ca3af;font-size:13px;margin:12px 0 0;">&#8617; Continuing from the beginning</p></div>');
                        $loader.before($separator);
                        $separator.after(existingEntry.element);

                        // Fade in
                        existingEntry.element.css('opacity', '0');
                        setTimeout(function() {
                            existingEntry.element.addClass('autoload-post-fadein');
                            //existingEntry.element.remove()
                            //console.log('Removed element');
                        }, 50);

                        // Remove old entry from its position, give it a fresh instance,
                        // push to end — one entry, one DOM node, always in sync
                        loadedPosts.splice(existingIndex, 1);
                        existingEntry.instance = loadInstanceCounter++;
                        loadedPosts.push(existingEntry);

                        $loader.fadeOut(function() { $(this).remove(); });
                        isLoading = false;

                        console.log('Post', nextPostId, 'moved to bottom (cyclic) — no fetch needed');
                        return;
                    }
                    // Fallthrough: entry not found — do a normal fetch
                }

                // --- NORMAL: fetch and append new post HTML ---
                fetchNextPostHtml(response.data.post_url)
                .done(function(html) {
                    console.log('Processing post', nextPostId, '- scoping CSS and HTML...');

                    const inlineScopedCSS = extractAndScopeStyles(html, nextPostId);
                    const externalScopedCSS = response.data.scoped_css || '';
                    const allScopedCSS = externalScopedCSS + '\n' + inlineScopedCSS;

                    const $content = extractPostContent(html);

                    if ($content.length) {
                        const scopedHTML = scopeHTMLWithPostId($content.prop('outerHTML'), nextPostId);
                        const $scopedContent = $(scopedHTML);

                        const $separator = $('<div class="autoload-separator"><hr></div>');

                        if (allScopedCSS) {
                            const $styleTag = $('<style type="text/css" data-post-id="' + nextPostId + '">' + allScopedCSS + '</style>');
                            $('head').append($styleTag);
                        }

                        $scopedContent.css('opacity', '0');

                        $loader.before($separator);
                        $separator.after($scopedContent);

                        setTimeout(function() {
                            $scopedContent.addClass('autoload-post-fadein');
                        }, 50);

                        const postExcerpt = getPostExcerpt($scopedContent);

                        loadedPosts.push({
                            id: nextPostId,
                            instance: loadInstanceCounter++,
                            url: response.data.post_url,
                            title: response.data.post_title,
                            excerpt: postExcerpt,
                            element: $scopedContent
                        });

                        $loader.fadeOut(function() {
                            $(this).remove();
                        });

                        isLoading = false;

                        if (typeof window.et_pb_init_modules === 'function') {
                            window.et_pb_init_modules();
                        }

                        console.log('Post', nextPostId, 'loaded successfully');
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
                // Server returned an error (e.g. only one post exists)
                $loader.html('<p>No more posts available.</p>').fadeOut(3000, function() {
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
     * Check if user has started scrolling in a specific post and trigger preload.
     * Uses instance index (not post ID) so cyclic repeats each get their own trigger.
     */
    function checkAndTriggerPreload() {
        const visiblePost = getPostInViewport();

        if (visiblePost && !scrollStartedInstances[visiblePost.instance]) {
            scrollStartedInstances[visiblePost.instance] = true;

            const visibleIndex = loadedPosts.findIndex(p => p.instance === visiblePost.instance);
            const nextPostExists = visibleIndex >= 0 && visibleIndex < loadedPosts.length - 1;

            if (!nextPostExists && !isLoading) {
                preloadNextPost();
            }
        }
    }
    
    /**
     * Initialize
     */
    $(document).ready(function() {
        if (!$('body').hasClass('single-post') && !$('body').hasClass('single')) {
            return;
        }
        
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
        
        scrollStartedInstances[0] = true; // instance 0 = the initial page post
        
        // Preload next post on page load
        preloadNextPost(true);
        
        // rAF-throttled scroll handler for smooth progress updates
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
        
        // Debounced scroll handler for heavier preload checks
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
                .stop(true, true)
                .slideToggle(300);
        });
    });
    
})(jQuery);