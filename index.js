const background = chrome.extension.getBackgroundPage();
let dbPromise = null;
let lastSession = 0;
let lastStopwatch = 0;
let pageData = [];
let currentPage = 'main'; // currentPage allows 3 page: main / session / stopwatch


(function() {
    dbPromise = idb.open('session-monitor-db', 1, upgradeDB => {
        upgradeDB.createObjectStore('session', { keyPath: ['id', 'domain'] });
        upgradeDB.createObjectStore('stopwatch', { keyPath: ['id', 'domain'] });
    });

    document.addEventListener("DOMContentLoaded", function() {
        loadMainPage(true);

        $(window).on('scroll', function(){
            if($(window).scrollTop() + $(window).height() >= $(document).height()) {
                (currentPage === 'main') ?
                    loadMainPage(false) :
                    (currentPage === 'session') ?
                        loadSessionPage(false) :
                        loadStopwatchPage(false);
            }
        })

        $('#stopwatch-btn, #session-btn, #main-btn').on('click', function(){
            let nextPage = $(this).attr('id').split('-')[0];
            if(nextPage !== currentPage){
                $(this).addClass('active');
                $('#' + currentPage + '-btn').removeClass('active');


                (nextPage === 'main') ?
                    loadMainPage(true) :
                    (nextPage === 'session') ?
                        loadSessionPage(true) :
                        loadStopwatchPage(true);
            }



            currentPage = nextPage;
        });
    });

    // Set an interval and call updatePage each seconds.
    // setInterval(function() {
    //     updatePage(false);
    // }, 1000);
}());

function loadMainPage(firstLoad){
    if(firstLoad){
        lastSession = 0;
        lastStopwatch = 0;
        $('.table-data>div:gt(1)').remove();
    }
    let mainData = [];
    // Using promises, the data from database is loaded step by step.
    openDatabase('session').then( sessionData => {
        // Get session data and put into mainData then open stopwatch database
        mainData = sessionData;
        return openDatabase('stopwatch');
    }).then( stopwatchData => {
        // Get stopwatch data and put into mainData and clean the data grabbed
        mainData = mainData.concat(stopwatchData);
        return cleanData(mainData, 'main');
    }).then( data => {
        // Use the cleaned data to make html
        return getHTMLFromData(data);
    }).then( html => {
        $('.table-data').append(html);
        return;
    }).catch( (e) => {
        console.warn(e);
    });
}

function loadSessionPage(firstLoad){
    if(firstLoad){
        lastSession = 0;
        lastStopwatch = 0;
        $('.table-data>div:gt(1)').remove();
    }
    // Using promises, the data from database is loaded step by step.
    openDatabase('session').then( sessionData => {
        // Get session data and put into mainData then open stopwatch database
        return cleanData(sessionData, 'session');
    }).then( data => {
        // Use the cleaned data to make html
        return getHTMLFromData(data);
    }).then( html => {
        $('.table-data').append(html);
        return;
    }).catch( (e) => {
        console.warn(e);
    });
}

function loadStopwatchPage(firstLoad){
    if(firstLoad){
        lastSession = 0;
        lastStopwatch = 0;
        $('.table-data>div:gt(1)').remove();
    }
    // Using promises, the data from database is loaded step by step.
    openDatabase('stopwatch').then( sessionData => {
        // Get session data and put into mainData then open stopwatch database
        return cleanData(sessionData, 'stopwatch');
    }).then( data => {
        // Use the cleaned data to make html
        return getHTMLFromData(data);
    }).then( html => {
        $('.table-data').append(html);
        return;
    }).catch( (e) => {
        console.warn(e);
    });
}

function openDatabase(type) {
    let start = (type === 'session') ? lastSession : lastStopwatch;
    let end = start + 19;

    // console.log(start + ' - ' + end);

    return promise = new Promise(
        function (resolve, reject) {

            let data = [];
            let startDate = 0;

            dbPromise.then(db => {
                let i = 0;
                let firstFound = false;
                let tx = db.transaction(type);

                tx.objectStore(type)
                    .iterateCursor(null, 'prev', cursor => {
                        /**
                         * Stop if cursor is empty or pass the end.
                         * If cursor is stopped, set the last session or
                         * stopwatch to i+1 (which would be the latest index).
                         **/
                        if (!cursor || i > end) {
                            if(type === 'session') {
                                lastSession = i;
                                lastSession++;
                            } else {
                                lastStopwatch = i;
                                lastStopwatch++;
                            }
                            return;
                        }

                        /**
                         * Check if startdate of a data is different.
                         * If it is different, means cursor is at a new
                         * session. If its a new session, it will mark the
                         * firstFound to true and increment.
                         *  */
                        if(startDate !== cursor.value.id) {
                            startDate = cursor.value.id;
                            firstFound = true;
                            i++;
                        } else {
                            firstFound = false;
                        }

                        // Pass if cursor is before start
                        if(i >= start){
                            /**
                             * If it is firstFound, it will add a new session
                             * into the data array.
                             */
                            if(firstFound) {
                                data.push({
                                    type: type,
                                    sDate: cursor.value.id,
                                    eDate: 0,
                                    cacheTotal: 0,
                                    transferredTotal: 0,
                                    data: []
                                });
                            }

                            data[data.length-1].data.push(cursor.value);
                            data[data.length-1].cacheTotal += cursor.value.data.cachedTransferred;
                            data[data.length-1].transferredTotal += cursor.value.data.transferred;

                            if(data[data.length-1].eDate < cursor.value.data.update){
                                data[data.length-1].eDate = cursor.value.data.update;
                            }
                        }
                        cursor.continue();
                    });

                tx.complete.then(() => {
                    if(data.length > 0) {
                        pageData = pageData.concat(data);
                        resolve(data);
                    } else {
                        resolve([]);
                    }
                });
            });
        }
    );
}

/**
 * cleanData is a function that will sort the datas in each session/stopwatch
 * in alphabetical order. If it is the main page, clean data will sort all
 * datas by date and remove excess data (max 20 per load).
 * @param {Object} data
 * @param {String} type
 */
function cleanData(data, type) {
    data.forEach( value => {
        value.data.sort(function(a,b) {
            if (a.domain === b.domain) {
                return 0;
            } else {
                if(a.domain < b.domain) {
                    return -1;
                } else {
                    return 1;
                }
            }
        });
    });

    if(type === 'main') {
        data.sort(function(a,b) {
            return b.sDate - a.sDate;
        });

        if (data.length > 20){
            for(i=20; i<data.length; i++){
                if(data[i].type === 'session') {
                    lastSession--;
                } else {
                    lastStopwatch--;
                }
            }
            data = data.slice(0, 20);
        }
    }

    return promise = new Promise(
        function (resolve, reject) {
            resolve(data);
        }
    );
}

function getHTMLFromData(datas){
    let html = '';

    datas.forEach( (sessions, i) => {
        let totalData = 0;
        let totalCached = 0;
        let totalTransferred = 0;

        let groupIndex = i + 1;

        html += '<div class=\'table-data-row top-group-data\' data-toggle=\'collapse\' data-target=\'#group-' + groupIndex + '\' aria-control=\'group-' + groupIndex + '\' aria-expanded=\'false\'>';

        html += '<div>' + sessions.type.charAt(0).toUpperCase() + sessions.type.slice(1) + '</div>';
        html += '<div>' + moment(sessions.sDate).format('ddd, Do MMM YYYY HH:mm') + '</div>';
        html += '<div>' + convertByteTable(sessions.transferredTotal) + '</div>';
        html += '<div>' + convertByteTable(sessions.cacheTotal) + '</div>';
        html += '<div>' + convertByteTable((sessions.transferredTotal + sessions.cacheTotal)) + '</div>';
        html += '</div>';
        html += '</div>';

        html += '<div id=\'group-' + groupIndex + '\' class=\'table-data-group collapse\'>';
        html += '<div class=\'table-break\'></div>'

        sessions.data.forEach( data => {
            html += '<div class=\'table-data-row\'>';

            html += '<div></div>'
            html += '<div></div>'
            html += '<div>' + data.domain + '</div>';
            html += '<div>' + convertByteTable(data.data.transferred) + '</div>';
            html += '<div>' + convertByteTable(data.data.cachedTransferred) + '</div>';

            let total = data.data.transferred + data.data.cachedTransferred;
            html += '<div>' + convertByteTable(total) + '</div>';
            html += '</div>';

            totalData += total;
            totalCached += data.data.cachedTransferred;
            totalTransferred += data.data.transferred;
        });


        let dur = sessions.eDate - sessions.sDate;


        html += '<div class=\'table-data-row bottom-group-data\'>';

        if(sessions.type === 'session'){
            html += '<div>Session length: ' + moment.duration(dur, 'milliseconds').format('h [hours] m [minutes]') + '</div>';
        } else {
            html += '<div>Stopwatch length: ' + moment.duration(dur, 'milliseconds').format('h [hours] m [minutes]') + '</div>';
        }

        html += '<div>' + convertByteTable(totalTransferred) + '</div>';
        html += '<div>' + convertByteTable(totalCached) + '</div>';
        html += '<div>' + convertByteTable(totalData) + '</div>';

        html += '</div>';
        html += '</div>';
        html += '<div class=\'table-break\'></div>'

    });


    return promise = new Promise(
        function (resolve, reject) {
            if(datas.length === 0){
                reject(currentPage + ' page reach the end.');
            }

            if(html.length !== 0){
                resolve(html);
            } else {
                reject('Generated HTML is empty.');
            }
        }
    );
}




/**
 * updatePage is a function that will update the popup page. updatePage will
 * accept boolean to check if it's the first call or not.
 * @param first {Boolean}
 */
function updatePagex(first){
    // Get pages from background.js and with boolean to check first or not call.
    var pages = background.getPages(first);

    // Use hard-coded timer to reduce the amount of calls between popup and background.
    if(!first){
        timer += 1000;
    }

    // Set timer UI.
    $('#session-timer').text(moment.duration(timer, 'milliseconds').format('hh:mm:ss', {trim: false}));

    // Check if pages from background changed.
    if(pages) {
        updatePageTable(pages);
        updatePageChart(pages);
        chart.update();
    }
}

function convertByteTable(b){
    // return (((Math.ceil((b/1000000)*1000))/1000).toFixed(3)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") + " MB"
    return (b/1000000).toFixed(2).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") + " MB"
}
// return Math.round(b/1000000) + " MB"

// function sort(type, button){
//     let dir = '';
//     $('.table-data > div:gt(1)').remove();

//     if(button.hasClass('fa-sort-up')) {
//         dir = 'desc';
//         button.removeClass('fa-sort-up');
//         button.addClass('fa-sort-down');
//     } else if(button.hasClass('fa-sort-down')) {
//         dir = 'asc';
//         button.removeClass('fa-sort-down');
//         button.addClass('fa-sort-up');
//     } else {
//         dir = 'desc';
//         $('.table-header > div > span').removeClass('fa-sort fa-sort-up fa-sort-down');
//         $('.table-header > div:not(.' + type + ') > span').addClass('fa-sort');
//         button.addClass('fa-sort-down');
//     }

//     sortPage(type, dir);

//     updatePage(pageData).then(function(v){
//         $('.table-data').append(v);
//         console.log("success");
//     });
// }