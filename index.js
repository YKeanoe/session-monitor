const background = chrome.extension.getBackgroundPage();
let dbPromise = null;
let currentPage = 1;
let lastSession = 0;
let pageData = [];

// TODO
// Find a way to grab both session and stopwatch.
// how main page work: grab 20 from session, grab 20 from  stopwatch, remove the oldest till its 20 item only, save the index of both stores.

(function() {
    dbPromise = idb.open('session-monitor-db', 1, upgradeDB => {
        upgradeDB.createObjectStore('session', { keyPath: ['id', 'domain'] });
        upgradeDB.createObjectStore('stopwatch', { keyPath: ['id', 'domain'] });
    });

    dbPromise.then(db => {
        return db.transaction('session')
            .objectStore('session').getAll();
    }).then(
        allObjs => console.log(allObjs)
    );

    document.addEventListener("DOMContentLoaded", function() {
        loadPage(1);
        $(window).on('scroll', function(){
            if($(window).scrollTop() + $(window).height() >= $(document).height()) {
                loadPage(currentPage);
                // console.log(pageData);
                // console.log(pageData);
            }
        })
    });

    // Set an interval and call updatePage each seconds.
    // setInterval(function() {
    //     updatePage(false);
    // }, 1000);
}());

function loadPage(page){
    // Using promises, the data from database is loaded step by step.
    openPage(page).then( data => {
        return cleanData(data);
    }).then( data => {
        return updatePage(data);
    }).then( html => {
        $('.table-data').append(html);
        currentPage++;
        return;
    }).catch( (e) => {
        console.warn(e);
    });
}

function openPage(page) {
    let start =  lastSession;
    let end = start + 19;

    console.log(start + ' - ' + end);

    return promise = new Promise(
        function (resolve, reject) {

            let data = [];
            let startDate = 0;

            dbPromise.then(db => {
                let i = 0;
                let firstFound = false;
                let tx = db.transaction('session');

                tx.objectStore('session')
                    .iterateCursor(null, 'prev', cursor => {
                        // Stop if cursor is empty or pass the end.
                        if (!cursor || i > end) {
                            lastSession = i;
                            lastSession++;
                            return;
                        }



                        /**
                         * Check if startdate of a data is different.
                         * If it is different, means cursor is at a new
                         * session. If its a new session, it will mark the
                         * firstFound to true and increment.
                         *  */
                        if(startDate !== cursor.value.id) {
                            // console.log('session ' + i);
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
                                // console.log('adding');
                                data.push({
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
                        console.log(pageData);
                        let amt = 0;
                        pageData.forEach(val => {
                            amt += val.data.length;
                        });
                        console.log(amt);
                        resolve(data);
                    } else {
                        reject(new Error('page data is empty'));
                    }
                });
            });
        }
    );
}

function cleanData(data){
    data.forEach( value => {
        value.data.sort(function(a,b) {
            if (a.domain === b.domain){
                return 0;
            } else {
                if(a.domain < b.domain){
                    return -1;
                } else {
                    return 1;
                }
            }
        });
    });

    return promise = new Promise(
        function (resolve, reject) {
            resolve(data);
        }
    );

}

function updatePage(datas){
    let id = 0;
    let html = '';

    datas.forEach( (sessions, i) => {
        let totalData = 0;
        let totalCached = 0;
        let totalTransferred = 0;

        let groupIndex = i + 1;
        // <a class="btn btn-primary" data-toggle="collapse" href="#collapseExample" role="button" aria-expanded="false" aria-controls="collapseExample">

        html += '<div class=\'table-data-row top-group-data\' data-toggle=\'collapse\' data-target=\'#group-' + groupIndex + '\' aria-control=\'group-' + groupIndex + '\' aria-expanded=\'false\'>';

        if(i % 2 === 0){
            html += '<div>Session</div>';
        }else{
            html += '<div>Stopwatch</div>';
        }

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
        html += '<div>Session length: ' + moment.duration(dur, 'milliseconds').format('h [hours] m [minutes]') + '</div>';
        html += '<div>' + convertByteTable(totalTransferred) + '</div>';
        html += '<div>' + convertByteTable(totalCached) + '</div>';
        html += '<div>' + convertByteTable(totalData) + '</div>';

        html += '</div>';
        html += '</div>';
        html += '<div class=\'table-break\'></div>'

    });


    return promise = new Promise(
        function (resolve, reject) {
            if(html.length !== 0){
                resolve(html);
            } else {
                reject(new Error('html is empty'));
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
    var pages = background.GetPages(first);

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