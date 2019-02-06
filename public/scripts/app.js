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
                this.catalogs = Object.keys(allCatalogs[this.selectedRepo].branches[this.selectedBranch].catalogs);
            },
            selectCatalog: function() {
                var context = this;
                $.getJSON('/catalog/'+this.selectedRepo+'/'+this.selectedBranch+'/'+this.selectedCatalog, function(catalogs) {
                    if (/.json$/.test(context.selectedCatalog)) {
                        catalogTable.messages(catalogs);
                    } else {
                        for (var l in catalogs) {
                            if (catalogs.hasOwnProperty(l)) {
                                catalogs[l] = {"text":catalogs[l]}
                            }
                        }
                        catalogTable.messages(catalogs,true);
                    }
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
                filterLanguages: JSON.parse(localStorage.filteredLanguages||"[]")
            }
        },
        // watch: {
        //     filterLanguages: function(A,B) {
        //         this.$forceUpdate();
        //     }
        // },
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
            messages: function(catalogs, plainText) {
                var langs = Object.keys(catalogs);
                langs.sort(function(A,B) {
                    if (A === 'en-US') {
                        return -1;
                    } else if (B === 'en-US') {
                        return 1;
                    }
                    return A.localeCompare(B);
                })
                var catalog = {};
                var reverseLookup = {};
                var dupes = {};

                var langCounts = {}
                this.languages = langs.slice();
                this.filteredLanguages = langs.slice();
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
                for (var k in catalog) {
                    if (catalog.hasOwnProperty(k)) {
                        catalog[k].key = k;
                        messages.push(catalog[k]);
                    }
                }
                this.gridColumns = [{key:'key',label:'key'}].concat(langs.map(function(k) { return {label:k+" ("+langCounts[k]+")",key:k} } ));
                if (plainText) {
                    this.gridColumns.shift();
                }
                this.plainText = !!plainText;
                this.gridData = messages;

                var dupeKeys = Object.keys(dupes);
                dupeKeys = dupeKeys.map(function(k) { return reverseLookup[k]})
            }
        }
    })
});
