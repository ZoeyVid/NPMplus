const Mn       = require('backbone.marionette');
const App      = require('../../main');
const template = require('./logs.ejs');

module.exports = Mn.View.extend({
    template:  template,
    className: 'modal-dialog modal-xl',

    ui: {
        log_type:      '#log-type',
        lines_count:   '#lines-count',
        search_filter: '#search-filter',
        refresh_logs:  '#refresh-logs',
        auto_refresh:  '#auto-refresh',
        log_loading:   '#log-loading',
        log_entries:   '#log-entries',
        log_empty:     '#log-empty',
        log_error:     '#log-error',
        log_stats:     '#log-stats',
        table_body:    '#log-table-body',
        error_message: '#error-message'
    },

    events: {
        'change @ui.log_type':      'refreshLogs',
        'change @ui.lines_count':   'refreshLogs',
        'keyup @ui.search_filter':  'onSearchChange',
        'click @ui.refresh_logs':   'refreshLogs',
        'click @ui.auto_refresh':   'toggleAutoRefresh'
    },

    initialize: function () {
        this.autoRefreshInterval = null;
        this.searchTimeout = null;
    },

    onRender: function () {
        this.refreshLogs();
    },

    onDestroy: function () {
        this.stopAutoRefresh();
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
        }
    },

    onSearchChange: function () {
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
        }
        this.searchTimeout = setTimeout(() => {
            this.refreshLogs();
        }, 500);
    },

    refreshLogs: function () {
        const log_type = this.ui.log_type.val();
        const lines = parseInt(this.ui.lines_count.val());
        const search = this.ui.search_filter.val().trim();

        this.showLoading();

        const params = {
            log_type: log_type,
            lines: lines
        };

        if (search) {
            params.search = search;
        }

        App.Api.Nginx.ProxyHosts.getLogs(this.model.get('id'), params)
            .then((result) => {
                this.displayLogs(result);
            })
            .catch((err) => {
                this.showError(err.message || 'Unknown error occurred');
            });
    },

    displayLogs: function (data) {
        this.hideAllViews();

        if (!data.entries || data.entries.length === 0) {
            this.ui.log_empty.removeClass('d-none');
            this.updateStats(data);
            return;
        }

        this.ui.log_entries.removeClass('d-none');
        this.renderLogEntries(data.entries);
        this.updateStats(data);
    },

    renderLogEntries: function (entries) {
        this.ui.table_body.empty();

        entries.forEach((entry) => {
            const row = this.createLogRow(entry);
            this.ui.table_body.append(row);
        });
    },

    createLogRow: function (entry) {
        const timestamp = entry.timestamp ? new Date(entry.timestamp).toLocaleString() : '-';
        const statusClass = this.getStatusClass(entry.status);
        const sizeFormatted = entry.size ? this.formatBytes(entry.size) : '-';
        
        return `
            <tr>
                <td class="text-monospace small">${timestamp}</td>
                <td class="text-monospace small">${entry.ip || '-'}</td>
                <td class="text-monospace small"><span class="badge badge-secondary">${entry.method || '-'}</span></td>
                <td class="text-monospace small"><span class="badge ${statusClass}">${entry.status || '-'}</span></td>
                <td class="text-monospace small">${sizeFormatted}</td>
                <td class="text-monospace small" style="word-break: break-all;">${entry.url || '-'}</td>
            </tr>
        `;
    },

    getStatusClass: function (status) {
        if (!status) return 'badge-secondary';
        if (status >= 200 && status < 300) return 'badge-success';
        if (status >= 300 && status < 400) return 'badge-info';
        if (status >= 400 && status < 500) return 'badge-warning';
        if (status >= 500) return 'badge-danger';
        return 'badge-secondary';
    },

    formatBytes: function (bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    updateStats: function (data) {
        const lastModified = data.last_modified ? new Date(data.last_modified).toLocaleString() : '-';
        const fileSize = data.file_size ? this.formatBytes(data.file_size) : '0 B';
        
        this.ui.log_stats.html(`
            <small>
                <strong>File Size:</strong> ${fileSize} | 
                <strong>Last Modified:</strong> ${lastModified} | 
                <strong>Entries Shown:</strong> ${data.total_lines}
            </small>
        `);
    },

    showLoading: function () {
        this.hideAllViews();
        this.ui.log_loading.removeClass('d-none');
    },

    showError: function (message) {
        this.hideAllViews();
        this.ui.error_message.text(message);
        this.ui.log_error.removeClass('d-none');
    },

    hideAllViews: function () {
        this.ui.log_loading.addClass('d-none');
        this.ui.log_entries.addClass('d-none');
        this.ui.log_empty.addClass('d-none');
        this.ui.log_error.addClass('d-none');
    },

    toggleAutoRefresh: function () {
        const isAutoRefreshing = this.ui.auto_refresh.attr('data-auto') === 'true';
        
        if (isAutoRefreshing) {
            this.stopAutoRefresh();
        } else {
            this.startAutoRefresh();
        }
    },

    startAutoRefresh: function () {
        this.ui.auto_refresh.attr('data-auto', 'true')
            .html('<i class="fe fe-pause"></i> Stop Auto-refresh')
            .removeClass('btn-secondary').addClass('btn-warning');
        
        this.autoRefreshInterval = setInterval(() => {
            this.refreshLogs();
        }, 5000); // 5秒間隔
    },

    stopAutoRefresh: function () {
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
            this.autoRefreshInterval = null;
        }
        
        this.ui.auto_refresh.attr('data-auto', 'false')
            .html('<i class="fe fe-play"></i> Auto-refresh')
            .removeClass('btn-warning').addClass('btn-secondary');
    }
});
