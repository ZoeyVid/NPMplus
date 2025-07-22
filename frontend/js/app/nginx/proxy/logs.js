const Mn       = require('backbone.marionette');
const App      = require('../../main');
const template = require('./logs.ejs');

module.exports = Mn.View.extend({
    template:  template,
    className: 'modal-dialog modal-dialog-scrollable',

    ui: {
        log_type:      '#log-type',
        lines_count:   '#lines-count',
        search_filter: '#search-filter',
        refresh_logs:  '#refresh-logs',
        auto_refresh:  '#auto-refresh',
        log_loading:   '#log-loading',
        log_entries:   '#log-entries',
        log_empty:     '#log-empty',
        log_no_results: '#log-no-results',
        log_error:     '#log-error',
        log_stats:     '#log-stats',
        table_body:    '#log-table-body',
        error_message: '#error-message',
        pagination:    '#pagination',
        page_info:     '#page-info',
        prev_page:     '#prev-page',
        next_page:     '#next-page',
        per_page:      '#per-page',
        ip_stats:      '#ip-stats',
        clear_search:  '#clear-search',
    },

    events: {
        'change @ui.log_type':      'refreshLogs',
        'change @ui.lines_count':   'refreshLogs',
        'change @ui.per_page':      'refreshLogs',
        'keyup @ui.search_filter':  'onSearchChange',
        'click @ui.refresh_logs':   'refreshLogs',
        'click @ui.auto_refresh':   'toggleAutoRefresh',
        'click @ui.prev_page':      'previousPage',
        'click @ui.next_page':      'nextPage',
        'click @ui.clear_search':   'clearSearch',
    },

    initialize: function () {
        this.autoRefreshInterval = null;
        this.searchTimeout = null;
        this.currentPage = 1;
    },
    
    onRender: function () {
        // カスタムモーダルサイズの適用
        this.$el.css('max-width', '95vw');
        this.$el.css('width', '95vw');
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
            this.currentPage = 1; // Reset to first page on search
            this.refreshLogs();
        }, 500);
    },

    refreshLogs: function () {
        const log_type = this.ui.log_type.val();
        const lines = parseInt(this.ui.lines_count.val());
        const search = this.ui.search_filter.val().trim();
        const per_page = parseInt(this.ui.per_page.val() || 10);

        this.showLoading();

        const params = {
            log_type: log_type,
            lines: lines,
            page: this.currentPage,
            per_page: per_page
        };

        // 空文字列や空白のみの場合はsearchパラメータを含めない
        if (search && search.length > 0) {
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
            // 検索フィルターがある場合は「検索結果なし」、そうでなければ「ログなし」を表示
            const search = this.ui.search_filter.val().trim();
            if (search && search.length > 0) {
                this.ui.log_no_results.removeClass('d-none');
            } else {
                this.ui.log_empty.removeClass('d-none');
            }
            this.updateStats(data);
            this.updatePagination(data);
            this.updateIPStats(data.ip_stats || []);
            return;
        }

        this.ui.log_entries.removeClass('d-none');
        this.renderLogEntries(data.entries);
        this.updateStats(data);
        this.updatePagination(data);
        this.updateIPStats(data.ip_stats || []);
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
        const search = this.ui.search_filter.val().trim();
        
        let statsText = `File: ${fileSize} | Modified: ${lastModified} | Total: ${data.total_lines || 0} entries`;
        if (search && search.length > 0) {
            statsText += ` | Search: "${search}"`;
        }
        
        this.ui.log_stats.html(`<small>${statsText}</small>`);
    },

    updatePagination: function (data) {
        if (!data.total_pages || data.total_pages <= 1) {
            this.ui.pagination.addClass('d-none');
            return;
        }

        this.ui.pagination.removeClass('d-none');
        this.ui.page_info.text(`Page ${data.current_page || 1} of ${data.total_pages}`);
        
        // Previous button
        if (data.current_page <= 1) {
            this.ui.prev_page.addClass('disabled');
        } else {
            this.ui.prev_page.removeClass('disabled');
        }
        
        // Next button
        if (data.current_page >= data.total_pages) {
            this.ui.next_page.addClass('disabled');
        } else {
            this.ui.next_page.removeClass('disabled');
        }
    },

    updateIPStats: function (ip_stats) {
        if (!ip_stats || ip_stats.length === 0) {
            this.ui.ip_stats.html('<div class="text-muted text-center">No IP statistics available</div>');
            return;
        }

        let html = '<div class="table-responsive"><table class="table table-sm mb-0">';
        html += '<thead><tr><th>IP Address</th><th class="text-right">Requests</th><th class="text-center">Actions</th></tr></thead>';
        html += '<tbody>';
        
        ip_stats.slice(0, 10).forEach(stat => {
            html += `
                <tr>
                    <td class="text-monospace">${stat.ip}</td>
                    <td class="text-right"><span class="badge badge-secondary">${stat.count}</span></td>
                    <td class="text-center">
                        <button class="btn btn-sm btn-outline-primary search-ip" data-ip="${stat.ip}" title="Search for this IP">
                            <i class="fe fe-search"></i>
                        </button>
                    </td>
                </tr>
            `;
        });
        html += '</tbody></table></div>';
        
        this.ui.ip_stats.html(html);
        
        // IP検索イベント
        this.ui.ip_stats.find('.search-ip').on('click', (e) => {
            e.preventDefault();
            const ip = $(e.currentTarget).data('ip');
            this.ui.search_filter.val(ip);
            this.currentPage = 1;
            this.refreshLogs();
        });
    },

    previousPage: function () {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.refreshLogs();
        }
    },

    nextPage: function () {
        this.currentPage++;
        this.refreshLogs();
    },

    clearSearch: function () {
        this.ui.search_filter.val('');
        this.currentPage = 1;
        this.refreshLogs();
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
        this.ui.log_no_results.addClass('d-none');
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
