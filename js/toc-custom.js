jQuery( function( $ ) {

	/**
	 * @typedef ezTOC
	 * @type {Object} ezTOC
	 * @property {string} affixSelector
	 * @property {string} scroll_offset
	 * @property {string} smooth_scroll
	 * @property {string} visibility_hide_by_default
	 */

	if ( typeof ezTOC != 'undefined' ) {

		/**
		 * Init EZ TOC.
		 */
		function ezTOCInit() {

			var affix = $( '.ez-toc-widget-container.ez-toc-affix' );

			if ( 0 !== affix.length ) {

				/**
				 * The smooth scroll offset needs to be taken into account when defining the offset_top property.
				 * @link https://github.com/shazahm1/Easy-Table-of-Contents/issues/19
				 *
				 * @type {number}
				 */
				var affixOffset = 30;

				// check offset setting
				if ( typeof ezTOC.scroll_offset != 'undefined' ) {
					affixOffset = parseInt( ezTOC.scroll_offset );
				}

				$( ezTOC.affixSelector ).stick_in_parent( {
					inner_scrolling: false,
					offset_top:      affixOffset
				} );
			}

			$.fn.shrinkTOCWidth = function() {
				$( this ).css( {
					width:   'auto',
					display: 'table'
				} );

				if ( /MSIE 7\./.test( navigator.userAgent ) )
					$( this ).css( 'width', '' );
			};

			if ( typeof ezTOC.visibility_hide_by_default != 'undefined' ) {

				// Get all toggles that have not been loaded.
				var toggles = $( '.ez-toc-toggle:not(.ez-toc-loaded),.ez-toc-widget-sticky-toggle:not(.ez-toc-loaded)' );
				var invert_device = ( typeof ezTOC.visibility_hide_by_device != 'undefined' ) ? ezTOC.visibility_hide_by_device : 0;

				$.each( toggles, function( i, obj ) {

					var toggle = $( this );
					toggle.addClass( 'ez-toc-loaded' );

					var $root   = toggle.closest( '.ez-toc-instance-root' );
					var $inner  = $root.children().first();
					var innerEl = $inner[0];
					var toc     = $root.find( 'ul.ez-toc-list, ul.ez-toc-widget-sticky-list' );

					var instanceInvert = ezTOC.visibility_hide_by_default;
					if ( toc.hasClass( 'eztoc-toggle-hide-by-default' ) ) {
						instanceInvert = 1;
					}

					if ( typeof Cookies !== 'undefined' ) {
						if ( Cookies ) {
							if ( Cookies.get( 'ezTOC_hidetoc-' + i ) == 1 ) {
								toggle.data( 'visible', false );
								if ( innerEl ) {
									innerEl.classList.add( 'toc_close' );
								}
							} else {
								toggle.data( 'visible', true );
							}
							Cookies.remove( 'ezTOC_hidetoc-' + i );
						} else {
							toggle.data( 'visible', true );
							Cookies.remove( 'ezTOC_hidetoc-' + i );
						}
					}

					if ( invert_device != '0' && instanceInvert ) {
						toggle.data( 'visible', false );
					}

					if ( ! toggle.data( 'visible' ) ) {
						toc.hide();
						if ( innerEl ) {
							var boxTitle = innerEl.querySelector( '.ez-toc-box-title' );
							if ( boxTitle ) {
								boxTitle.classList.add( 'toc-closed' );
							}
						}
					}

				} );
			}

			// ======================================
			// Set active heading in ez-toc-widget list
			// ======================================

			var headings = $( 'span.ez-toc-section' ).toArray();
			var headingToListElementLinkMap = getHeadingToListElementLinkMap( headings );
			var listElementLinks = $.map( headingToListElementLinkMap, function( value, key ) {
				return value;
			} );
			var scrollOffset = getScrollOffset();

			activateSetActiveEzTocListElement();

			function setActiveEzTocListElement() {
				var activeHeading = getActiveHeading( scrollOffset, headings );
				if ( activeHeading ) {
					var activeListElementLink = headingToListElementLinkMap[ activeHeading.id ];
					removeStyleFromNonActiveListElement( activeListElementLink, listElementLinks );
					setStyleForActiveListElementElement( activeListElementLink );
				}
			}

			function activateSetActiveEzTocListElement() {
				if ( headings.length > 0 && $( '.ez-toc-widget-container' ).length ) {
					$( window ).on( 'load resize scroll', setActiveEzTocListElement );
				}
			}

			function deactivateSetActiveEzTocListElement() {
				$( window ).off( 'load resize scroll', setActiveEzTocListElement );
			}

			function getEzTocListElementLinkByHeading( heading ) {
				return $( '.ez-toc-widget-container .ez-toc-list a[href="#' + $( heading ).attr( 'id' ) + '"]' );
			}

			function getHeadingToListElementLinkMap( headings ) {
				return headings.reduce( function( map, heading ) {
					map[ heading.id ] = getEzTocListElementLinkByHeading( heading );
					return map;
				}, {} );
			}

			function getScrollOffset() {
				var scrollOffset = 5;
				if ( typeof ezTOC.smooth_scroll != 'undefined' && parseInt( ezTOC.smooth_scroll ) === 1 ) {
					scrollOffset = ( typeof ezTOC.scroll_offset != 'undefined' ) ? parseInt( ezTOC.scroll_offset ) : 30;
				}
				var adminbar = $( '#wpadminbar' );
				if ( adminbar.length ) {
					scrollOffset += adminbar.height();
				}
				return scrollOffset;
			}

			function getActiveHeading( topOffset, headings ) {
				var scrollTop = $( window ).scrollTop();
				var relevantOffset = scrollTop + topOffset + 1;
				var activeHeading = headings[ 0 ];
				var closestHeadingAboveOffset = relevantOffset - $( activeHeading ).offset().top;
				headings.forEach( function( section ) {
					var topOffset = relevantOffset - $( section ).offset().top;
					if ( topOffset > 0 && topOffset < closestHeadingAboveOffset ) {
						closestHeadingAboveOffset = topOffset;
						activeHeading = section;
					}
				} );
				return activeHeading;
			}

			function removeStyleFromNonActiveListElement( activeListElementLink, listElementLinks ) {
				listElementLinks.forEach( function( listElementLink ) {
					if ( activeListElementLink !== listElementLink && listElementLink.parent().hasClass( 'active' ) ) {
						listElementLink.parent().removeClass( 'active' );
					}
				} );
			}

			function correctActiveListElementBackgroundColorHeight( activeListElement ) {
				var listElementHeight = getListElementHeightWithoutUlChildren( activeListElement );
				addListElementBackgroundColorHeightStyleToHead( listElementHeight );
			}

			function getListElementHeightWithoutUlChildren( listElement ) {
				var $listElement = $( listElement );
				var content = $listElement.html();
				$listElement.parent().append( '<li id="ez-toc-height-test" class="active">' + content + '</li>' );
				var listItem = $( '#ez-toc-height-test' );
				var height = listItem.height();
				listItem.remove();
				return height - ( $listElement.children( 'ul' ).first().height() || 0 );
			}

			function addListElementBackgroundColorHeightStyleToHead( listElementHeight ) {
				$( '.ez-toc-widget-container ul.ez-toc-list li.active' ).css( 'height', listElementHeight + 'px' );
			}

			function setStyleForActiveListElementElement( activeListElementLink ) {
				var activeListElement = activeListElementLink.parent();
				if ( ! activeListElement.hasClass( 'active' ) ) {
					activeListElement.addClass( 'active' );
				}
				correctActiveListElementBackgroundColorHeight( activeListElement );
			}
		}

		// ─── DELEGATED CLICK: JS-based toggle (<a class="ez-toc-toggle">) ───────────
		// Handles the local/JS toggle variant. Bound on document so it catches all
		// instances regardless of .ez-toc-loaded state at init time.
		$( document ).on( 'click', '.ez-toc-toggle, .ez-toc-widget-sticky-toggle', function( event ) {

			event.preventDefault();

			var $clickedRoot   = $( this ).closest( '.ez-toc-instance-root' );
			var $clickedInner  = $clickedRoot.children().first();
			var clickedInnerEl = $clickedInner[0];

			if ( ! clickedInnerEl ) return;

			clickedInnerEl.classList.toggle( 'toc_close' );

			var boxTitle = clickedInnerEl.querySelector( '.ez-toc-box-title' );
			if ( boxTitle ) {
				boxTitle.classList.toggle( 'toc-closed' );
			}

			var $clickedToc = $clickedRoot.find( 'ul.ez-toc-list, ul.ez-toc-widget-sticky-list' );

			var isVisible = $clickedInner.data( 'ez-toc-visible' );
			if ( typeof isVisible === 'undefined' ) {
				isVisible = true;
			}

			var instanceInvert = $clickedInner.data( 'ez-toc-invert' );
			if ( typeof instanceInvert === 'undefined' ) {
				instanceInvert = ezTOC.visibility_hide_by_default;
			}

			var i = $( '.ez-toc-toggle, .ez-toc-widget-sticky-toggle' ).index( this );

			if ( isVisible ) {
				$clickedInner.data( 'ez-toc-visible', false );
				if ( typeof Cookies !== 'undefined' && Cookies ) {
					if ( instanceInvert )
						Cookies.set( 'ezTOC_hidetoc-' + i, null, { path: '/', sameSite: 'Strict' } );
					else
						Cookies.set( 'ezTOC_hidetoc-' + i, '1', { expires: 30, path: '/', sameSite: 'Strict' } );
				}
				$clickedToc.hide( 'fast' );
			} else {
				$clickedInner.data( 'ez-toc-visible', true );
				if ( typeof Cookies !== 'undefined' && Cookies ) {
					if ( instanceInvert )
						Cookies.set( 'ezTOC_hidetoc-' + i, '1', { expires: 30, path: '/', sameSite: 'Strict' } );
					else
						Cookies.set( 'ezTOC_hidetoc-' + i, null, { path: '/', sameSite: 'Strict' } );
				}
				$clickedToc.show( 'fast' );
			}

		} );
		// ─────────────────────────────────────────────────────────────────────────────

		// ─── DELEGATED CLICK: CSS checkbox toggle (<label class="ez-toc-cssicon-toggle-label">) ──
		// Handles the production/CSS-checkbox variant (ez-toc-v2_0_82_2+).
		// The label's `for` attribute points to a unique checkbox per instance,
		// so the CSS show/hide already works natively. This handler ONLY manages:
		// - toc_close class on the inner container (for CSS that targets it)
		// - box-title toc-closed state
		// - cookie persistence
		// State is read from the checkbox `checked` property BEFORE the label toggles it
		// (the browser flips checked after click, so we read pre-click state here).
		$( document ).on( 'click', 'label.ez-toc-cssicon-toggle-label', function( event ) {

			var $label        = $( this );
			var $clickedRoot  = $label.closest( '.ez-toc-instance-root' );
			var $clickedInner = $clickedRoot.children().first();
			var clickedInnerEl = $clickedInner[0];

			if ( ! clickedInnerEl ) return;

			// Find the checkbox this label controls via its `for` attribute.
			var forId    = $label.attr( 'for' );
			// Use querySelector with attribute selector to handle special characters in IDs (dots, colons etc)
			var checkboxEl = forId ? document.querySelector( '[id="' + forId + '"]' ) : $clickedInner.find( 'input[type="checkbox"]' )[0];
			var currentlyChecked = checkboxEl ? checkboxEl.checked : false;

			// Read checked state BEFORE browser toggles it on click.
			// If currently checked → user is hiding → add toc_close.
			// If currently unchecked → user is showing → remove toc_close.

			// Use setTimeout so our class change runs AFTER browser toggles checkbox.
			setTimeout( function() {
				if ( currentlyChecked ) {
					// Was visible, now hiding.
					clickedInnerEl.classList.add( 'toc_close' );
					var boxTitle = clickedInnerEl.querySelector( '.ez-toc-box-title' );
					if ( boxTitle ) boxTitle.classList.add( 'toc-closed' );
				} else {
					// Was hidden, now showing.
					clickedInnerEl.classList.remove( 'toc_close' );
					var boxTitle = clickedInnerEl.querySelector( '.ez-toc-box-title' );
					if ( boxTitle ) boxTitle.classList.remove( 'toc-closed' );
				}

				// Cookie: store per-instance state using the instance index.
				var i = $( 'label.ez-toc-cssicon-toggle-label' ).index( $label[0] );
				var instanceInvert = $clickedInner.data( 'ez-toc-invert' );
				if ( typeof instanceInvert === 'undefined' ) {
					instanceInvert = ezTOC.visibility_hide_by_default;
				}

				if ( typeof Cookies !== 'undefined' && Cookies ) {
					if ( currentlyChecked ) {
						// Hiding.
						if ( instanceInvert )
							Cookies.set( 'ezTOC_hidetoc-' + i, null, { path: '/', sameSite: 'Strict' } );
						else
							Cookies.set( 'ezTOC_hidetoc-' + i, '1', { expires: 30, path: '/', sameSite: 'Strict' } );
					} else {
						// Showing.
						if ( instanceInvert )
							Cookies.set( 'ezTOC_hidetoc-' + i, '1', { expires: 30, path: '/', sameSite: 'Strict' } );
						else
							Cookies.set( 'ezTOC_hidetoc-' + i, null, { path: '/', sameSite: 'Strict' } );
					}
				}
			}, 0 );

		} );
		// ─────────────────────────────────────────────────────────────────────────────

		// ─── CHANGE 7 ───────────────────────────────────────────────────────────────
		// Was: if ($('#ez-toc-container').length) — ID-based, single instance only.
		// Now: loops over ALL instances via wrapper and injects fallback icon into each.
		$( '.ez-toc-instance-root' ).each( function() {
			var $inner = $( this ).children().first();
			if ( ! $inner.find( '.ez-toc-toggle label span' ).html() ) {
				$inner.find( '.ez-toc-toggle label' ).html( ezTOC.fallbackIcon );
			}
		} );
		// ────────────────────────────────────────────────────────────────────────────

		/**
		 * Attach global init handler to ezTOC window object.
		 */
		ezTOC.init = function() {
			ezTOCInit();
		};

		// Start EZ TOC on page load.
		ezTOCInit();

		// Ensure proper column layout for TOC
		function optimizeTOCColumns() {
			$( '.ez-toc-list[class*="ez-toc-columns-"]' ).each( function() {
				var $list = $( this );
				var columnClass = $list.attr( 'class' ).match( /ez-toc-columns-(\d+)/ );
				if ( ! columnClass ) return;

				var columns = parseInt( columnClass[ 1 ] );
				if ( columns <= 1 ) return;

				$list.addClass( 'ez-toc-columns-optimized' );

				$list.find( 'li' ).each( function() {
					var $item = $( this );
					var itemHeight = $item.outerHeight();
					if ( itemHeight > 50 ) {
						$item.css( 'break-inside', 'avoid' );
					}
				} );
			} );
		}

		setTimeout( optimizeTOCColumns, 100 );

		if ( typeof ezTOC.ajax_toggle != 'undefined' && parseInt( ezTOC.ajax_toggle ) === 1 ) {
			$( document ).ajaxComplete( function() {
				ezTOCInit();
				setTimeout( optimizeTOCColumns, 100 );
			} );
		}

		// ─── CHANGE 8 ───────────────────────────────────────────────────────────────
		// Was: $('#ez-toc-container').find('.hamburger').remove() — single instance only.
		// Now: targets all instances via wrapper so chamomile theme cleanup runs on each.
		if ( parseInt( ezTOC.chamomile_theme_is_on ) === 1 ) {
			$( '.ez-toc-instance-root' ).each( function() {
				$( this ).children().first().find( '.hamburger' ).remove();
			} );
		}
		// ────────────────────────────────────────────────────────────────────────────

	}

	$( document ).on( 'click', '#ez-toc-open-sub-hd', function( e ) {
		$( this ).attr( 'id', 'ez-toc-open-sub-hd-active' );
		e.preventDefault();
	} );

	$( document ).on( 'click', '#ez-toc-open-sub-hd-active', function( e ) {
		$( this ).attr( 'id', 'ez-toc-open-sub-hd' );
		e.preventDefault();
	} );

	$( '#ez-toc-more-links-enabler' ).click( function() {
		$( '.ez-toc-more-link' ).show();
		$( '#ez-toc-more-links-enabler' ).hide();
		$( '#ez-toc-more-links-disabler' ).attr( 'style', 'display:inline-block' );
	} );

	$( '#ez-toc-more-links-disabler' ).click( function() {
		$( '.ez-toc-more-link' ).hide();
		$( '#ez-toc-more-links-enabler' ).show();
		$( '#ez-toc-more-links-disabler' ).hide();
	} );

} );