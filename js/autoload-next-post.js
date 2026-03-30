(function($) {
    'use strict';
    
    let isLoading = false;
    let loadedPosts = [];
    let currentPostId = diviAutoLoad.currentPostId;
    let scrollStartedPosts = {};
    let $readingWidget = null;
    let $widgetProgressFill = null;
    let $floatingButton = null;
    let $goToTopButton = null;
    let $goToBottomButton = null;
    let isWidgetOpen = true;
    let loadedAllPosts = false;

    // TOC state
    let lastVisiblePostId = null;

    // Get settings from localized data
    const settings = diviAutoLoad.settings || {};
    const scrollTrigger    = parseInt(settings.scrollTrigger)    || 30;
    const widgetAutoClose  = parseInt(settings.widgetAutoClose)  || 300;
    const showProgress     = settings.showProgress     === '1';
    const showTopButton    = settings.showTopButton    === '1';
    const showBottomButton = settings.showBottomButton === '1';

    // Initialize with current post
    const $initialElement = $('.et_pb_post, article.post').first();

    loadedPosts.push({
        id:      currentPostId,
        url:     window.location.href,
        title:   document.title,
        toc:     null,
        element: $initialElement
    });

    // ─── Table of Contents ────────────────────────────────────────────────────

    /**
     * Scan h1/h2/h3 inside $postElement, stamp each with a data-toc-id anchor,
     * return array of { level, text, anchorId, $el }.
     */
    function buildTOC($postElement, postId) {
        const items = [];
        $postElement.find('h1, h2, h3').each(function(i) {
            const $h   = $(this);
            const text = $h.text().trim();
            if (!text) return;

            let anchorId = $h.attr('data-toc-id');
            if (!anchorId) {
                anchorId = 'toc-' + postId + '-' + i;
                $h.attr('data-toc-id', anchorId);
            }

            items.push({
                level:    parseInt($h.prop('tagName').replace('H', '')),
                text:     text,
                anchorId: anchorId,
                $el:      $h
            });
        });
        return items;
    }

    /**
     * Render TOC items as HTML list.
     * H1 = 0px indent, H2 = 14px, H3 = 28px
     */
    function renderTOC(items) {
        if (!items || !items.length) {
            return '<p class="toc-empty">No headings found in this post.</p>';
        }
        const indent = { 1: 0, 2: 14, 3: 28 };
        let html = '<ul class="autoload-toc-list">';
        items.forEach(function(item) {
            const pad = indent[item.level] || 0;
            html += '<li class="toc-item toc-level-' + item.level + '" data-toc-id="' + item.anchorId + '" style="padding-left:' + pad + 'px">'
                  + '<a href="#" class="toc-link" data-toc-id="' + item.anchorId + '">'
                  + '<span class="toc-marker"></span>'
                  + '<span class="toc-text">' + $('<div>').text(item.text).html() + '</span>'
                  + '</a>'
                  + '</li>';
        });
        html += '</ul>';
        return html;
    }

    /**
     * Return the anchorId of the heading currently in view.
     *
     * Strategy: use the heading that is closest ABOVE the viewport centre.
     * - Calculate a detection line at 40% from the top of the viewport.
     *   Headings above this line are "past", headings below are "upcoming".
     * - Walk the list and keep updating activeId for every heading whose top
     *   is at or above the detection line — the last one to qualify is the
     *   one the reader just scrolled past, i.e. the active section.
     * - If no heading has crossed the line yet (reader is above the first
     *   heading), return the first item so something is always highlighted.
     */
    function getActiveTocId(items) {
        if (!items || !items.length) return null;

        const scrollTop      = $(window).scrollTop();
        const windowHeight   = $(window).height();
        // Detection line: 40% down the viewport — headings above this are "active"
        const detectionLine  = scrollTop + windowHeight * 0.40;

        let activeId   = null;
        let closestTop = -Infinity;

        items.forEach(function(item) {
            if (!item.$el || !item.$el.length) return;
            const top = item.$el.offset().top;
            // Heading must have crossed the detection line
            if (top <= detectionLine && top > closestTop) {
                closestTop = top;
                activeId   = item.anchorId;
            }
        });

        // Nothing has crossed the line yet — highlight the first heading
        if (!activeId) activeId = items[0].anchorId;

        return activeId;
    }

    /**
     * Highlight the active TOC item and scroll it into view within the list.
     */
    function highlightActiveTocItem(activeId) {
        const $list = $readingWidget.find('.autoload-toc-list');
        $list.find('.toc-item').removeClass('toc-active');
        if (!activeId) return;

        const $active = $list.find('.toc-item[data-toc-id="' + activeId + '"]');
        $active.addClass('toc-active');

        if ($active.length) {
            const listTop    = $list.scrollTop();
            const listHeight = $list.outerHeight();
            const itemTop    = $active.position().top;
            const itemHeight = $active.outerHeight();
            if (itemTop < 0) {
                $list.scrollTop(listTop + itemTop - 8);
            } else if (itemTop + itemHeight > listHeight) {
                $list.scrollTop(listTop + itemTop + itemHeight - listHeight + 8);
            }
        }
    }

    // ─── UI creation ─────────────────────────────────────────────────────────

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
        $floatingButton.on('click', function() { toggleWidget(); });
    }

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
                const currentIndex = loadedPosts.findIndex(p => p.id === visiblePost.id);
                if (currentIndex >= 0 && currentIndex <= loadedPosts.length - 1) {
                    const prevPost = loadedPosts[currentIndex - 1];
                    if (prevPost && prevPost.element && prevPost.element.length) {
                        $('html, body').animate({ scrollTop: prevPost.element.offset().top - 100 }, 600, 'swing');
                        return;
                    }
                }
                if (currentIndex === 0) {
                    $('html, body').animate({ scrollTop: visiblePost.element.offset().top - 100 }, 600, 'swing');
                }
            }
        });
    }

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
                const currentIndex = loadedPosts.findIndex(p => p.id === visiblePost.id);
                if (currentIndex >= 0 && currentIndex < loadedPosts.length - 1) {
                    const nextPost = loadedPosts[currentIndex + 1];
                    if (nextPost && nextPost.element && nextPost.element.length) {
                        $('html, body').animate({ scrollTop: nextPost.element.offset().top - 100 }, 600, 'swing');
                        return;
                    }
                }
                const postBottom = visiblePost.element.offset().top + visiblePost.element.outerHeight();
                $('html, body').animate({ scrollTop: postBottom - $(window).height() + 200 }, 600, 'swing');
            }
        });
    }

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
                        <svg class="widget-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h10"/>
                        </svg>
                    </div>
                    <h3 class="reading-post-title"></h3>
                </div>

                <div class="widget-toc-section"></div>

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

        $readingWidget.find('.widget-close-btn').on('click', function() { closeWidget(); });

        // Delegate TOC link clicks — smooth scroll to heading
        $readingWidget.on('click', '.toc-link', function(e) {
            e.preventDefault();
            const anchorId = $(this).data('toc-id');
            const $heading = $('[data-toc-id="' + anchorId + '"]');
            if ($heading.length) {
                $('html, body').animate({ scrollTop: $heading.offset().top - 80 }, 500, 'swing');
            }
        });
    }

    // ─── Widget open/close ────────────────────────────────────────────────────

    function toggleWidget() {
        if (isWidgetOpen) { closeWidget(); } else { openWidget(); }
    }

    function openWidget() {
        isWidgetOpen = true;
        $readingWidget.addClass('open');
        $floatingButton.removeClass('visible');
        if ($goToTopButton)    $goToTopButton.removeClass('visible');
        if ($goToBottomButton) $goToBottomButton.removeClass('visible');
    }

    function closeWidget() {
        isWidgetOpen = false;
        $readingWidget.removeClass('open');
        setTimeout(function() {
            $floatingButton.addClass('visible');
            if (showTopButton    && $goToTopButton)    $goToTopButton.addClass('visible');
            if (showBottomButton && $goToBottomButton) $goToBottomButton.addClass('visible');
        }, 300);
    }

    // ─── Progress / URL / TOC update ─────────────────────────────────────────

    function updateProgressRing(percentage) {
        const circle = $floatingButton.find('.progress-ring-circle')[0];
        const radius = circle.r.baseVal.value;
        const circumference = radius * 2 * Math.PI;
        const offset = circumference - (percentage / 100) * circumference;
        circle.style.strokeDasharray  = `${circumference} ${circumference}`;
        circle.style.strokeDashoffset = offset;
    }

    function updateReadingWidget() {
        if (!$readingWidget || !$floatingButton) return;

        const scrollTop   = $(window).scrollTop();
        const visiblePost = getPostInViewport();

        // Show nav buttons only when widget is closed AND past scroll threshold.
        if (!isWidgetOpen && scrollTop > widgetAutoClose) {
            if (showTopButton    && $goToTopButton)    $goToTopButton.addClass('visible');
            if (showBottomButton && $goToBottomButton) $goToBottomButton.addClass('visible');
        } else {
            if ($goToTopButton)    $goToTopButton.removeClass('visible');
            if ($goToBottomButton) $goToBottomButton.removeClass('visible');
        }

        if (!visiblePost) return;

        // Update title
        $readingWidget.find('.reading-post-title').text(visiblePost.title);
        $floatingButton.attr('title', visiblePost.title);

        // Rebuild TOC only when the visible post changes
        if (visiblePost.id !== lastVisiblePostId) {
            lastVisiblePostId = visiblePost.id;

            // Build lazily on first view
            if (!visiblePost.toc) {
                visiblePost.toc = buildTOC(visiblePost.element, visiblePost.id);
            }
            $readingWidget.find('.widget-toc-section').html(renderTOC(visiblePost.toc));
        }

        // Highlight active TOC item on every scroll tick
        if (visiblePost.toc && visiblePost.toc.length) {
            highlightActiveTocItem(getActiveTocId(visiblePost.toc));
        }

        // Update progress bar and ring
        if (visiblePost.element && visiblePost.element.length) {
            const scrollPercentage = getScrollPercentage(visiblePost.element);
            const clampedPercentage = Math.min(Math.max(scrollPercentage, 0), 100);

            $readingWidget.find('.progress-percentage').text(Math.round(clampedPercentage) + '%');
            $widgetProgressFill.css('width', clampedPercentage + '%');
            $floatingButton.find('.button-percentage').text(Math.round(clampedPercentage) + '%');
            updateProgressRing(clampedPercentage);
        }
    }

    // ─── Utility functions ────────────────────────────────────────────────────

    function getScrollPercentage(article) {
        if (!article.length) return 0;
        const articleTop    = article.offset().top;
        const articleHeight = article.outerHeight();
        const scrollTop     = $(window).scrollTop();
        const windowHeight  = $(window).height();
        const scrolled      = scrollTop + windowHeight - articleTop;
        return Math.min(Math.max((scrolled / articleHeight) * 100, 0), 100);
    }

    function getPostInViewport() {
        const scrollTop      = $(window).scrollTop();
        const windowHeight   = $(window).height();
        const viewportMiddle = scrollTop + (windowHeight / 2);
        let currentPost = null;
        let minDistance = Infinity;

        loadedPosts.forEach(function(post) {
            if (post.element && post.element.length) {
                const postTop    = post.element.offset().top;
                const postHeight = post.element.outerHeight();
                const distance   = Math.abs(viewportMiddle - (postTop + postHeight / 2));
                if (viewportMiddle >= postTop && viewportMiddle <= postTop + postHeight) {
                    if (distance < minDistance) { minDistance = distance; currentPost = post; }
                }
            }
        });
        return currentPost;
    }

    function updateUrlForVisiblePost() {
        const visiblePost = getPostInViewport();
        if (visiblePost && visiblePost.url !== window.location.href) {
            if (history.replaceState) {
                history.replaceState(null, visiblePost.title, visiblePost.url);
                document.title = visiblePost.title;
            }
        }
    }

    // ─── Scroll handlers ──────────────────────────────────────────────────────

    function handleScrollLight() {
        updateUrlForVisiblePost();
        updateReadingWidget();
    }

    function handleScrollHeavy() {
        checkAndTriggerPreload();

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

    // ─── CSS / HTML scoping ───────────────────────────────────────────────────

    function scopeCSSWithPostId(cssText, postId) {
        if (!cssText) return '';
        const postSuffix = '_post_' + postId;
        // Only scope et_pb_ builder rules — do NOT scope et- theme rules
        cssText = cssText.replace(/\.et_pb_([a-zA-Z0-9_-]+)/g, '.et_pb_$1' + postSuffix);
        cssText = cssText.replace(/#et_pb_([a-zA-Z0-9_-]+)/g,  '#et_pb_$1' + postSuffix);
        return cssText;
    }

    function scopeHTMLWithPostId(html, postId) {
        const postSuffix = '_post_' + postId;
        const $html = $('<div>').html(html);

        // Only scope et_pb_ builder classes — do NOT scope et- theme classes
        $html.find('[class*="et_pb_"]').each(function() {
            const $el  = $(this);
            const cls  = $el.attr('class');
            if (cls) {
                $el.attr('class', cls.replace(/\bet_pb_([a-zA-Z0-9_-]+)\b/g, 'et_pb_$1' + postSuffix));
            }
        });

        // Scope et_pb_ IDs only
        $html.find('[id*="et_pb_"]').each(function() {
            const $el = $(this);
            const id  = $el.attr('id');
            if (id) {
                $el.attr('id', id.replace(/^et_pb_([a-zA-Z0-9_-]+)$/, 'et_pb_$1' + postSuffix));
            }
        });

        // Strip remaining plain IDs (e.g. id="post-73") but preserve
        // WordPress comment form IDs needed by theme CSS and JS
        const WP_KEEP_IDS = [
            'commentform', 'comment', 'author', 'email', 'url',
            'comment-wrap', 'comments', 'respond', 'reply-title',
            'cancel-comment-reply-link', 'comment-form'
        ];
        $html.find('[id]').each(function() {
            const $el = $(this);
            const id  = $el.attr('id');
            if (id && id.indexOf(postSuffix) === -1 && !WP_KEEP_IDS.includes(id)) {
                $el.removeAttr('id');
            }
        });

        return $html.html();
    }

    function extractAndScopeStyles(html, postId) {
        const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
        if (!headMatch) return '';
        let allScopedCSS = '';
        const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
        let m;
        while ((m = styleRegex.exec(headMatch[1])) !== null) {
            allScopedCSS += scopeCSSWithPostId(m[1], postId) + '\n';
        }
        return allScopedCSS;
    }

    // ─── AJAX helpers ─────────────────────────────────────────────────────────

    function getNextPostId(postId) {
        return $.ajax({
            url:  diviAutoLoad.ajaxUrl,
            type: 'POST',
            data: { action: 'get_next_post_id', post_id: postId, nonce: diviAutoLoad.nonce }
        });
    }

    function fetchNextPostHtml(postUrl) {
        return $.ajax({ url: postUrl, type: 'GET', dataType: 'html' });
    }

    function extractPostContent(html) {
        const $html = $('<div>').html(html);
        let content = $html.find('.et_pb_post, article.post').first();
        if (!content.length) content = $html.find('article').first();
        if (!content.length) content = $html.find('.entry-content').first();
        return content;
    }

    function isPostLoaded(postId) {
        return loadedPosts.some(function(post) { return post.id === postId; });
    }

    // ─── Core loader ──────────────────────────────────────────────────────────

    function preloadNextPost(forceLoad) {
        if (isLoading) return;

        const lastPost  = loadedPosts[loadedPosts.length - 1];
        if (!forceLoad) {
            const lastIndex = loadedPosts.findIndex(p => p.id === lastPost.id);
            if (lastIndex < loadedPosts.length - 1) return;
        }

        isLoading = true;

        const $loader = $('<div class="autoload-loader"><div class="spinner"></div><p>Processing next post...</p></div>');
        lastPost.element.after($loader);

        getNextPostId(lastPost.id)
        .done(function(response) {
            if (response.success && response.data.post_url) {
                const nextPostId = response.data.post_id;

                if (isPostLoaded(nextPostId)) {
                    $loader.remove();
                    isLoading = false;
                    return;
                }

                fetchNextPostHtml(response.data.post_url)
                .done(function(html) {
                    const inlineScopedCSS   = extractAndScopeStyles(html, nextPostId);
                    const externalScopedCSS = response.data.scoped_css || '';
                    const allScopedCSS      = externalScopedCSS + '\n' + inlineScopedCSS;

                    const $content = extractPostContent(html);

                    if ($content.length) {
                        const $scopedContent = $(scopeHTMLWithPostId($content.prop('outerHTML'), nextPostId));
                        const $separator     = $('<div class="autoload-separator"><hr></div>');

                        if (allScopedCSS) {
                            $('head').append('<style type="text/css" data-post-id="' + nextPostId + '">' + allScopedCSS + '</style>');
                        }

                        $scopedContent.css('opacity', '0');
                        $loader.before($separator);
                        $separator.after($scopedContent);

                        setTimeout(function() { $scopedContent.addClass('autoload-post-fadein'); }, 50);

                        loadedPosts.push({
                            id:      nextPostId,
                            url:     response.data.post_url,
                            title:   response.data.post_title,
                            toc:     null,
                            element: $scopedContent
                        });

                        $loader.fadeOut(function() { $(this).remove(); });
                        isLoading = false;

                        if (typeof window.et_pb_init_modules === 'function') {
                            window.et_pb_init_modules();
                        }
                    } else {
                        $loader.html('<p>Could not load next post.</p>').fadeOut(3000, function() { $(this).remove(); });
                        isLoading = false;
                    }
                })
                .fail(function() {
                    $loader.html('<p>Error loading next post.</p>').fadeOut(3000, function() { $(this).remove(); });
                    isLoading = false;
                });
            } else {
                if (response.data === 'No next post found') {
                    loadedAllPosts = true;
                }
                $loader.html('<p>No more posts to load.</p>').fadeOut(3000, function() { $(this).remove(); });
                isLoading = false;
            }
        })
        .fail(function() {
            $loader.html('<p>Error fetching next post.</p>').fadeOut(3000, function() { $(this).remove(); });
            isLoading = false;
        });
    }

    // ─── Init ─────────────────────────────────────────────────────────────────

    $(document).ready(function() {
        if (!$('body').hasClass('single-post') && !$('body').hasClass('single')) return;

        if (showProgress) {
            createReadingWidget();
            createFloatingButton();
        }
        if (showTopButton)    createGoToTopButton();
        if (showBottomButton) createGoToBottomButton();

        scrollStartedPosts[currentPostId] = true;

        preloadNextPost(true);

        // rAF-throttled light handler (progress + URL)
        let ticking = false;
        $(window).on('scroll', function() {
            if (!ticking) {
                window.requestAnimationFrame(function() { handleScrollLight(); ticking = false; });
                ticking = true;
            }
        });

        // Debounced heavy handler (preload trigger)
        let scrollTimeout;
        $(window).on('scroll', function() {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(handleScrollHeavy, 200);
        });

        handleScrollLight();
        handleScrollHeavy();

        jQuery(document).on('click', '.comment-section-toggle-button', function() {
            jQuery(this)
                .closest('.et_post_meta_wrapper')
                .find('#comment-wrap')
                .stop(true, true)
                .slideToggle(300);
        });
    });

})(jQuery);