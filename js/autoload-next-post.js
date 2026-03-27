(function($) {
    'use strict';

    let isLoading = false;
    let loadedPosts = [];
    let currentPostId = diviAutoLoad.currentPostId;
    let loadInstanceCounter = 0;
    let scrollStartedInstances = {};
    let $readingWidget = null;
    let $widgetProgressFill = null;
    let $floatingButton = null;
    let $goToTopButton = null;
    let $goToBottomButton = null;
    let isWidgetOpen = true;
    let lastVisiblePostInstance = null; // track when post changes to rebuild TOC

    const settings = diviAutoLoad.settings || {};
    const scrollTrigger    = parseInt(settings.scrollTrigger)  || 30;
    const widgetAutoClose  = parseInt(settings.widgetAutoClose) || 300;
    const showProgress     = settings.showProgress   === '1';
    const showTopButton    = settings.showTopButton  === '1';
    const showBottomButton = settings.showBottomButton === '1';

    // ─── Initial post setup ───────────────────────────────────────────────────

    const $initialElement = $('.et_pb_post, article.post').first();

    // Strip ALL id attributes from the initial server-rendered element so that
    // moving it cyclically never creates duplicate IDs in the document.
    $initialElement.removeAttr('id');
    $initialElement.find('[id]').removeAttr('id');

    loadedPosts.push({
        id:       currentPostId,
        instance: loadInstanceCounter++,
        url:      window.location.href,
        title:    document.title,
        toc:      null,           // built lazily on first widget render
        element:  $initialElement
    });

    // ─── Table of Contents ────────────────────────────────────────────────────

    /**
     * Scan h1/h2/h3 inside $postElement, stamp each with a unique anchor ID,
     * and return an array of { level, text, anchorId, $el } objects.
     * Safe to call multiple times — skips headings that already have an anchor.
     */
    function buildTOC($postElement, postId) {
        const items = [];
        $postElement.find('h1, h2, h3').each(function(i) {
            const $h   = $(this);
            const text = $h.text().trim();
            if (!text) return; // skip empty headings

            // Assign a stable anchor ID if not already set
            let anchorId = $h.attr('data-toc-id');
            if (!anchorId) {
                anchorId = 'toc-' + postId + '-' + i;
                $h.attr('data-toc-id', anchorId);
            }

            items.push({
                level:    parseInt($h.prop('tagName').replace('H', '')), // 1, 2, or 3
                text:     text,
                anchorId: anchorId,
                $el:      $h
            });
        });
        return items;
    }

    /**
     * Render TOC items as a scrollable list inside the widget.
     * Indentation: h1 = 0px, h2 = 14px, h3 = 28px
     */
    function renderTOC(items) {
        if (!items || !items.length) {
            return '<p class="toc-empty" style="color:rgba(255,255,255,0.6);font-size:13px;margin:0;">No headings found in this post.</p>';
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
     * Given scroll position, return the anchorId of the heading currently
     * "active" — the last heading whose top is above (or at) viewport top + offset.
     */
    function getActiveTocId(items) {
        if (!items || !items.length) return null;
        const scrollTop = $(window).scrollTop() + 120; // offset so heading activates slightly before reaching top
        let activeId = items[0].anchorId;

        items.forEach(function(item) {
            if (item.$el && item.$el.length) {
                const top = item.$el.offset().top;
                if (top <= scrollTop) {
                    activeId = item.anchorId;
                }
            }
        });
        return activeId;
    }

    /**
     * Highlight the active TOC item and scroll it into view inside the widget list.
     */
    function highlightActiveTocItem(activeId) {
        const $list = $readingWidget.find('.autoload-toc-list');
        $list.find('.toc-item').removeClass('toc-active');

        if (activeId) {
            const $active = $list.find('.toc-item[data-toc-id="' + activeId + '"]');
            $active.addClass('toc-active');

            // Auto-scroll the TOC list so the active item stays visible
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
    }

    // ─── Utility functions ────────────────────────────────────────────────────

    function scopeCSSWithPostId(cssText, postId) {
        if (!cssText) return '';
        const s = '_post_' + postId;
        cssText = cssText.replace(/\.et_pb_([a-zA-Z0-9_-]+)/g, '.et_pb_$1' + s);
        cssText = cssText.replace(/#et_pb_([a-zA-Z0-9_-]+)/g,  '#et_pb_$1' + s);
        cssText = cssText.replace(/\.et-([a-zA-Z0-9_-]+)/g,    '.et-$1'    + s);
        return cssText;
    }

    function scopeHTMLWithPostId(html, postId) {
        const s = '_post_' + postId;
        const $html = $('<div>').html(html);

        $html.find('[class*="et_pb_"], [class*="et-"]').each(function() {
            const $el = $(this);
            const cls = $el.attr('class');
            if (cls) {
                let c = cls.replace(/\bet_pb_([a-zA-Z0-9_-]+)\b/g, 'et_pb_$1' + s);
                c = c.replace(/\bet-([a-zA-Z0-9_-]+)\b/g, 'et-$1' + s);
                $el.attr('class', c);
            }
        });

        $html.find('[id*="et_pb_"], [id*="et-"]').each(function() {
            const $el = $(this);
            const id = $el.attr('id');
            if (id) {
                let newId = id.replace(/^et_pb_([a-zA-Z0-9_-]+)$/, 'et_pb_$1' + s);
                newId = newId.replace(/^et-([a-zA-Z0-9_-]+)$/, 'et-$1' + s);
                $el.attr('id', newId);
            }
        });

        // Strip any remaining plain IDs (e.g. id="post-73")
        $html.find('[id]').each(function() {
            const $el = $(this);
            const id = $el.attr('id');
            if (id && id.indexOf(s) === -1) {
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

    function getScrollPercentage(article) {
        if (!article.length) return 0;
        const articleTop   = article.offset().top;
        const articleHeight = article.outerHeight();
        const scrollTop    = $(window).scrollTop();
        const windowHeight = $(window).height();
        return Math.min(Math.max(((scrollTop + windowHeight - articleTop) / articleHeight) * 100, 0), 100);
    }

    function getPostInViewport() {
        const scrollTop      = $(window).scrollTop();
        const windowHeight   = $(window).height();
        const viewportMiddle = scrollTop + windowHeight / 2;
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

    function getNextPostIdAjax(postId) {
        return $.ajax({
            url: diviAutoLoad.ajaxUrl,
            type: 'POST',
            data: { action: 'get_next_post_id', post_id: postId, nonce: diviAutoLoad.nonce }
        });
    }

    function fetchNextPostHtml(postUrl) {
        return $.ajax({ url: postUrl, type: 'GET', dataType: 'html' });
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
        $floatingButton.on('click', toggleWidget);
    }

    function createGoToTopButton() {
        $goToTopButton = $(`
            <button class="autoload-goto-top-button" aria-label="Go to Top">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18"/>
                </svg>
            </button>
        `);
        $('body').append($goToTopButton);
        $goToTopButton.on('click', function() {
            const vp = getPostInViewport();
            if (!vp) return;
            const idx = loadedPosts.findIndex(p => p.instance === vp.instance);
            const target = idx > 0 ? loadedPosts[idx - 1] : vp;
            $('html, body').animate({ scrollTop: target.element.offset().top - 100 }, 600, 'swing');
        });
    }

    function createGoToBottomButton() {
        $goToBottomButton = $(`
            <button class="autoload-goto-bottom-button" aria-label="Go to Next Post">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"/>
                </svg>
            </button>
        `);
        $('body').append($goToBottomButton);
        $goToBottomButton.on('click', function() {
            const vp = getPostInViewport();
            if (!vp) return;
            const idx = loadedPosts.findIndex(p => p.instance === vp.instance);
            if (idx >= 0 && idx < loadedPosts.length - 1) {
                $('html, body').animate({ scrollTop: loadedPosts[idx + 1].element.offset().top - 100 }, 600, 'swing');
            } else {
                const bottom = vp.element.offset().top + vp.element.outerHeight();
                $('html, body').animate({ scrollTop: bottom - $(window).height() + 200 }, 600, 'swing');
            }
        });
    }

    function createReadingWidget() {
        $readingWidget = $(`
            <div class="autoload-reading-widget open">
                <button class="widget-close-btn" aria-label="Close">
                    <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
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
                    <div class="progress-bar-mini"><div class="progress-fill-mini"></div></div>
                </div>
            </div>
        `);
        $widgetProgressFill = $readingWidget.find('.progress-fill-mini');
        $('body').append($readingWidget);
        $readingWidget.find('.widget-close-btn').on('click', closeWidget);

        // Delegate TOC link clicks — smooth scroll to heading
        $readingWidget.on('click', '.toc-link', function(e) {
            e.preventDefault();
            const anchorId = $(this).data('toc-id');
            // Find the heading with this data-toc-id across all loaded posts
            const $heading = $('[data-toc-id="' + anchorId + '"]');
            if ($heading.length) {
                $('html, body').animate({ scrollTop: $heading.offset().top - 80 }, 500, 'swing');
            }
        });
    }

    // ─── Widget open/close ────────────────────────────────────────────────────

    function toggleWidget() { isWidgetOpen ? closeWidget() : openWidget(); }

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

    function updateProgressRing(pct) {
        const circle = $floatingButton.find('.progress-ring-circle')[0];
        const r = circle.r.baseVal.value;
        const c = r * 2 * Math.PI;
        circle.style.strokeDasharray  = c + ' ' + c;
        circle.style.strokeDashoffset = c - (pct / 100) * c;
    }

    function updateReadingWidget() {
        if (!$readingWidget || !$floatingButton) return;

        const scrollTop   = $(window).scrollTop();
        const visiblePost = getPostInViewport();

        if (scrollTop > widgetAutoClose && isWidgetOpen) closeWidget();

        if (scrollTop > widgetAutoClose && !isWidgetOpen) {
            if (showTopButton    && $goToTopButton)    $goToTopButton.addClass('visible');
            if (showBottomButton && $goToBottomButton) $goToBottomButton.addClass('visible');
        } else if (scrollTop <= widgetAutoClose) {
            if ($goToTopButton)    $goToTopButton.removeClass('visible');
            if ($goToBottomButton) $goToBottomButton.removeClass('visible');
        }

        if (!visiblePost) return;

        // ── Post title ──
        $readingWidget.find('.reading-post-title').text(visiblePost.title);
        $floatingButton.attr('title', visiblePost.title);

        // ── TOC: rebuild only when the visible post changes ──
        if (visiblePost.instance !== lastVisiblePostInstance) {
            lastVisiblePostInstance = visiblePost.instance;

            // Build TOC lazily on first view of this post instance
            if (!visiblePost.toc) {
                visiblePost.toc = buildTOC(visiblePost.element, visiblePost.id);
            }

            $readingWidget.find('.widget-toc-section').html(renderTOC(visiblePost.toc));
        }

        // ── Highlight active TOC item on every scroll ──
        if (visiblePost.toc && visiblePost.toc.length) {
            const activeId = getActiveTocId(visiblePost.toc);
            highlightActiveTocItem(activeId);
        }

        // ── Progress bar + ring ──
        if (visiblePost.element && visiblePost.element.length) {
            const pct = Math.min(Math.max(getScrollPercentage(visiblePost.element), 0), 100);
            $readingWidget.find('.progress-percentage').text(Math.round(pct) + '%');
            $widgetProgressFill.css('width', pct + '%');
            $floatingButton.find('.button-percentage').text(Math.round(pct) + '%');
            updateProgressRing(pct);
        }
    }

    function updateUrlForVisiblePost() {
        const vp = getPostInViewport();
        if (vp && vp.url !== window.location.href && history.replaceState) {
            history.replaceState(null, vp.title, vp.url);
            document.title = vp.title;
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
                if (index === loadedPosts.length - 1
                    && getScrollPercentage(post.element) >= scrollTrigger
                    && !isLoading) {
                    preloadNextPost();
                }
            }
        });
    }

    function checkAndTriggerPreload() {
        const vp = getPostInViewport();
        if (vp && !scrollStartedInstances[vp.instance]) {
            scrollStartedInstances[vp.instance] = true;
            const idx = loadedPosts.findIndex(p => p.instance === vp.instance);
            if (idx === loadedPosts.length - 1 && !isLoading) {
                preloadNextPost();
            }
        }
    }

    // ─── Core loader ──────────────────────────────────────────────────────────

    function preloadNextPost(forceLoad) {
        if (isLoading) return;

        const lastPost  = loadedPosts[loadedPosts.length - 1];
        const lastIndex = loadedPosts.findIndex(p => p.instance === lastPost.instance);
        if (!forceLoad && lastIndex < loadedPosts.length - 1) return;

        isLoading = true;

        const $loader = $('<div class="autoload-loader"><div class="spinner"></div><p>Loading next post...</p></div>');
        lastPost.element.after($loader);

        getNextPostIdAjax(lastPost.id)
        .done(function(response) {
            if (!response.success || !response.data.post_url) {
                $loader.html('<p>No more posts available.</p>').fadeOut(3000, function() { $(this).remove(); });
                isLoading = false;
                return;
            }

            const nextPostId = response.data.post_id;
            const isCyclic   = response.data.cyclic || false;

            // ── CYCLIC: move existing element, clear its cached TOC so it rebuilds
            //            after the move (heading offsets will have changed) ──────
            if (isCyclic) {
                const existingIndex = loadedPosts.findIndex(p => p.id === nextPostId);

                if (existingIndex !== -1) {
                    const entry = loadedPosts[existingIndex];

                    entry.element.prev('.autoload-separator').remove();
                    entry.element.detach();

                    const $sep = $('<div class="autoload-separator"><hr><p style="text-align:center;color:#9ca3af;font-size:13px;margin:12px 0 0;">&#8617; Continuing from the beginning</p></div>');
                    $loader.before($sep);
                    $sep.after(entry.element);

                    entry.element.css('opacity', '0');
                    setTimeout(function() { entry.element.addClass('autoload-post-fadein'); }, 50);

                    // Invalidate cached TOC — heading offsets change after DOM move
                    entry.toc = null;

                    loadedPosts.splice(existingIndex, 1);
                    entry.instance = loadInstanceCounter++;
                    loadedPosts.push(entry);

                    $loader.fadeOut(function() { $(this).remove(); });
                    isLoading = false;
                    return;
                }
            }

            // ── Single-post guard ────────────────────────────────────────────
            if (loadedPosts[loadedPosts.length - 1].id === nextPostId) {
                $loader.remove();
                isLoading = false;
                return;
            }

            // ── NORMAL fetch ─────────────────────────────────────────────────
            fetchNextPostHtml(response.data.post_url)
            .done(function(html) {
                const allScopedCSS = (response.data.scoped_css || '') + '\n' + extractAndScopeStyles(html, nextPostId);
                const $h = $('<div>').html(html);
                const $raw = $h.find('.et_pb_post, article.post').first().length
                    ? $h.find('.et_pb_post, article.post').first()
                    : ($h.find('article').first().length ? $h.find('article').first() : $h.find('.entry-content').first());

                if (!$raw.length) {
                    $loader.html('<p>Could not load next post.</p>').fadeOut(3000, function() { $(this).remove(); });
                    isLoading = false;
                    return;
                }

                const $newContent = $(scopeHTMLWithPostId($raw.prop('outerHTML'), nextPostId));

                if (allScopedCSS.trim()) {
                    $('head').append('<style type="text/css" data-post-id="' + nextPostId + '">' + allScopedCSS + '</style>');
                }

                const $sep = $('<div class="autoload-separator"><hr></div>');
                $newContent.css('opacity', '0');
                $loader.before($sep);
                $sep.after($newContent);
                setTimeout(function() { $newContent.addClass('autoload-post-fadein'); }, 50);

                loadedPosts.push({
                    id:       nextPostId,
                    instance: loadInstanceCounter++,
                    url:      response.data.post_url,
                    title:    response.data.post_title,
                    toc:      null,   // built lazily when first visible
                    element:  $newContent
                });

                $loader.fadeOut(function() { $(this).remove(); });
                isLoading = false;
                if (typeof window.et_pb_init_modules === 'function') window.et_pb_init_modules();
            })
            .fail(function() {
                $loader.html('<p>Error loading next post.</p>').fadeOut(3000, function() { $(this).remove(); });
                isLoading = false;
            });
        })
        .fail(function() {
            $loader.html('<p>Error fetching next post.</p>').fadeOut(3000, function() { $(this).remove(); });
            isLoading = false;
        });
    }

    // ─── Init ─────────────────────────────────────────────────────────────────

    $(document).ready(function() {
        if (!$('body').hasClass('single-post') && !$('body').hasClass('single')) return;

        if (showProgress)     { createReadingWidget(); createFloatingButton(); }
        if (showTopButton)    createGoToTopButton();
        if (showBottomButton) createGoToBottomButton();

        scrollStartedInstances[0] = true;
        preloadNextPost(true);

        let ticking = false;
        $(window).on('scroll', function() {
            if (!ticking) {
                window.requestAnimationFrame(function() { handleScrollLight(); ticking = false; });
                ticking = true;
            }
        });

        let scrollTimeout;
        $(window).on('scroll', function() {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(handleScrollHeavy, 200);
        });

        handleScrollLight();
        handleScrollHeavy();

        $(document).on('click', '.comment-section-toggle-button', function() {
            $(this).closest('.et_post_meta_wrapper').find('#comment-wrap').stop(true, true).slideToggle(300);
        });
    });

})(jQuery);