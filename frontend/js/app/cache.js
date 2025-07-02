const UserModel = require('../models/user');

let cache = {
    User:    new UserModel.Model(),
    locale:  localStorage.getItem('language') || navigator.languages[0].toLowerCase(),
    
    // Language management functions
    setLanguage: function(lang) {
        this.locale = lang;
        localStorage.setItem('language', lang);
        // Reload page to apply language changes
        window.location.reload();
    },
    
    getAvailableLanguages: function() {
        return {
            'en': '🇺🇸 English',
            'de': '🇩🇪 Deutsch', 
            'it': '🇮🇹 Italiano',
            'zh': '🇨🇳 中文',
            'tr': '🇹🇷 Türkçe'
        };
    }
};

module.exports = cache;

