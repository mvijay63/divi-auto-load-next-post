(function() {
    'use strict';

    // Tab switching
    var tabs = document.querySelectorAll('.divi-autoload-tab');
    var contents = document.querySelectorAll('.divi-autoload-tab-content');

    // Get section from URL parameter or default to 'general'
    var urlParams = new URLSearchParams(window.location.search);
    var activeTab = urlParams.get('section') || 'general';

    console.log('activeTab ', activeTab);
    
    // Restore active tab on page load based on URL
    tabs.forEach(function(tab) {
        if (tab.dataset.tab === activeTab) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
    
    contents.forEach(function(content) {
        if (content.id === 'tab-' + activeTab) {
            content.classList.add('active');
        } else {
            content.classList.remove('active');
        }
    });


    // tabs.forEach(function(tab) {
    //     tab.addEventListener('click', function() {
    //         tabs.forEach(function(t) { t.classList.remove('active'); });
    //         contents.forEach(function(c) { c.classList.remove('active'); });

    //         this.classList.add('active');
    //         document.getElementById('tab-' + this.dataset.tab).classList.add('active');
    //     });
    // });

    // Position option cards
    document.querySelectorAll('.divi-autoload-position-option input').forEach(function(radio) {
        radio.addEventListener('change', function() {
            document.querySelectorAll('.divi-autoload-position-option').forEach(function(opt) {
                opt.classList.remove('active');
            });
            this.closest('.divi-autoload-position-option').classList.add('active');
        });
    });
})();