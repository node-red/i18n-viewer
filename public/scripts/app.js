$(function() {

    Vue.filter('escapeHTML', function(value) {
        if (!value) return ''
        value = value.toString()
        return value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    })
    Vue.filter('highlightMessage', function (value) {
        if (!value) return ''
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
        el: '#catalog-list',
        data: {
            repos: [],
            branches: [],
            catalogs: [],
            selectedRepo: '',
            selectedBranch: '',
            selectedCatalog: ''
        },
        methods: {
            selectRepo: function() {
                this.branches = Object.keys(allCatalogs[this.selectedRepo].branches);
            },
            selectBranch: function() {
                this.catalogs = allCatalogs[this.selectedRepo].branches[this.selectedBranch].catalogs;
            },
            selectCatalog: function() {
                var context = this;
                $.getJSON('/catalog/'+this.selectedRepo+'/'+this.selectedBranch+'/'+this.selectedCatalog, function(catalogs) {
                    catalogTable.messages(catalogs,!/.json$/.test(context.selectedCatalog));
                });
            }
        }
    })
    var allCatalogs;
    $.getJSON('/catalogs', function(data) {
        allCatalogs = data;
        for (var repo in data) {
            if (data.hasOwnProperty(repo)) {
                catalogList.repos.push(repo);
            }
        }
    });

    Vue.component('catalog-table', {
        template: '#catalog-table-template',
        props: {
            data: Array,
            columns: Array,
            plaintext: Boolean,
            languages: Array
        },
        data: function () {
            var sortOrders = {}
            this.columns.forEach(function (key) {
                sortOrders[key] = 1
            })
            return {
                sortKey: '',
                sortOrders: sortOrders,
                filterKey: '',
                filterLanguages: JSON.parse(localStorage.filteredLanguages||"[]"),
                filterOutdated: false
            }
        },
        // watch: {
        //     filterLanguages: function(A,B) {
        //         this.$forceUpdate();
        //     }
        // },
        computed: {
            filteredData: function () {
                var self = this;
                var sortKey = this.sortKey
                var filterOutdated = this.filterOutdated;
                var filterKey = this.filterKey && this.filterKey.toLowerCase()
                var order = this.sortOrders[sortKey] || 1
                var data = this.data
                var requiredLangs = this.languages.filter(function(value) { return -1 !== self.filterLanguages.indexOf(value) });
                var requiredKeys = {key:true};
                var requiredKeyCount = requiredLangs.length+1;

                if (filterOutdated) {
                    requiredLangs.forEach(function(k) { requiredKeys[k] = true; })
                }
                if (filterKey || filterOutdated) {
                    data = data.filter(function (row) {
                        var keys = Object.keys(row);
                        var now = row['en-US']?row['en-US'].u : 0;
                        var match = false;
                        var matchKeyCount = 0;
                        var matchFilterKey = false;
                        keys.forEach(function(key) {
                            if (filterOutdated) {
                                if (requiredKeys[key]) {
                                    matchKeyCount++;
                                    match = match || (row[key].u < now)
                                }
                            }
                            if (filterKey) {
                                matchFilterKey = matchFilterKey || row[key].v.toLowerCase().indexOf(filterKey) > -1
                            }
                        })

                        match = !filterOutdated || (match || matchKeyCount !== requiredKeyCount);

                        if (filterKey) {
                            match = matchFilterKey && match;
                        }
                        return match;
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
            showLanguage: function(lang) {
                return lang==='key'|| this.filterLanguages.indexOf(lang) !== -1;
            },
            sortBy: function (key) {
                this.sortKey = key
                this.sortOrders[key] = this.sortOrders[key] * -1
            },
            updateLanguages: function() {
                localStorage.filteredLanguages = JSON.stringify(this.filterLanguages)
            }
        }
    })

    var catalogTable = new Vue({
        el: '#catalogTable',
        data: {
            gridColumns: [],
            gridData: [],
            plainText: false,
            languages: [],
            filteredLanguages: []
        },
        methods: {
            messages: function(catalog, plainText) {
                var messages = [];
                var langCounts = {};
                for (var key in catalog) {
                    var entry = catalog[key];
                    Object.keys(entry).forEach(function(k) { langCounts[k] = langCounts[k] || 0; langCounts[k]++ });
                    entry.key = {v:key};
                    messages.push(entry);
                }
                var langs = Object.keys(langCounts);
                langs.sort(function(A,B) {
                    if (A === 'en-US') {
                        return -1;
                    } else if (B === 'en-US') {
                        return 1;
                    }
                    return A.localeCompare(B);
                })

                this.languages = langs.slice();
                this.filteredLanguages = langs.slice();
                this.gridColumns = [{key:'key',label:'key'}].concat(langs.map(function(k) { return {label:k+" ("+langCounts[k]+")"+(!!plainText?(' '+new Date(messages[0][k].u).toISOString()):''),key:k} } ));
                if (plainText) {
                    this.gridColumns.shift();
                }
                this.plainText = !!plainText;
                this.gridData = messages;
            }
        }
    })
});
