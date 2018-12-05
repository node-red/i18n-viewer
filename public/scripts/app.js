$(function() {

    Vue.filter('escapeHTML', function(value) {
        if (!value) { return ''; }
        value = value.toString()
        return value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    })

    Vue.filter('highlightMessage', function (value) {
        if (!value) { return ''; }
        value = value.toString()
        return value.replace(/(__.*?__)/g,'<span class="message-insert">$1</span>')
    })

    function flattenObject(obj) {
        var results = {};
        for (var k in obj) {
            if (obj.hasOwnProperty(k)) {
                if (typeof obj[k] === 'string') {
                    results[k] = obj[k];
                } else {
                    var subProps = flattenObject(obj[k]);
                    for (var kk in subProps) {
                        if (subProps.hasOwnProperty(kk)) {
                            results[k+"."+kk] = subProps[kk];
                        }
                    }
                }
            }
        }
        return results;
    }

    var catalogList = new Vue({
        el: '#projects',
        data: {
            projects: [],
            selectedp: '',
            catalogs: [],
            selectedc: ''
        },
        methods: {
            selectProject() {
                this.selectedc = '';
                catalogTable.gridColumns = [];
                catalogTable.gridData = [];
            },
            selectCatalog() {
                $.getJSON('/catalog/'+this.selectedc, function(catalogs) {

                    var langs = Object.keys(catalogs);
                    var catalog = {};
                    var reverseLookup = {};
                    var dupes = {};

                    var langCounts = {}

                    for (var i=0;i<langs.length;i++) {
                        langCounts[langs[i]] = 0;
                        var flatCat = flattenObject(catalogs[langs[i]]);
                        for (var k in flatCat) {
                            if (flatCat.hasOwnProperty(k)) {
                                langCounts[langs[i]]++;
                                catalog[k] = catalog[k] || {};
                                catalog[k][langs[i]] = flatCat[k];
                                reverseLookup[flatCat[k]] = reverseLookup[flatCat[k]] || [];
                                reverseLookup[flatCat[k]].push(k+":"+langs[i]);
                                if (reverseLookup[flatCat[k]].length > 1) {
                                    dupes[flatCat[k]] = true
                                }
                            }
                        }
                    }
                    var messages = [];
                    for (var c in catalog) {
                        if (catalog.hasOwnProperty(c)) {
                            catalog[c].key = c;
                            messages.push(catalog[c]);
                        }
                    }

                    catalogTable.gridColumns = [{key:'key',label:'key'}].concat(langs.map(function(k) { return {label:k+" ("+langCounts[k]+")",key:k} } ));
                    catalogTable.gridData = messages;

                    var dupeKeys = Object.keys(dupes);
                    dupeKeys = dupeKeys.map(function(k) { return reverseLookup[k]})

                });
            }
        }
    })

    $.getJSON('/projects', function(data) {
        catalogList.projects = data;
    });

    $.getJSON('/catalogs', function(data) {
        for (var catalog in data) {
            if (data.hasOwnProperty(catalog)) {
                catalogList.catalogs.push(catalog);
            }
        }
    });

    Vue.component('catalog-table', {
        template: '#catalog-table-template',
        props: {
            data: Array,
            columns: Array
        },
        data: function () {
            var sortOrders = {}
            this.columns.forEach(function (key) {
                sortOrders[key] = 1
            })
            return {
                sortKey: '',
                sortOrders: sortOrders,
                filterKey: ''
            }
        },
        computed: {
            filteredData: function () {
                var sortKey = this.sortKey
                var filterKey = this.filterKey && this.filterKey.toLowerCase()
                var order = this.sortOrders[sortKey] || 1
                var data = this.data
                if (filterKey) {
                    data = data.filter(function (row) {
                        return Object.keys(row).some(function (key) {
                            return String(row[key]).toLowerCase().indexOf(filterKey) > -1
                        })
                    })
                }
                if (sortKey) {
                    data = data.slice().sort(function (a, b) {
                        a = a[sortKey]
                        b = b[sortKey]
                        return (a === b ? 0 : a > b ? 1 : -1) * order
                    })
                }
                return data
            }
        },
        filters: {
            capitalize: function (str) {
                return str.charAt(0).toUpperCase() + str.slice(1)
            }
        },
        methods: {
            sortBy: function (key) {
                this.sortKey = key
                this.sortOrders[key] = this.sortOrders[key] * -1
            }
        }
    })

    var catalogTable = new Vue({
        el: '#catalogTable',
        data: {
            gridColumns: [],
            gridData: []
        }
    })
});
