const background = chrome.extension.getBackgroundPage();
let dbPromise = null;
let currentPage = 1;


(function() {


    // TODO
    // Fix the date format in the table. it seems wrong.

    console.log((new Date).getTime());
    console.log(moment(1544544506507).format('ddd, Do MMM YYYY HH:mm'));

    dbPromise = idb.open('session-monitor-db', 1, upgradeDB => {
        upgradeDB.createObjectStore('session', { keyPath: ['id', 'domain'] });
        upgradeDB.createObjectStore('watchSession', { keyPath: ['id', 'domain'] });
    });

    document.addEventListener("DOMContentLoaded", function() {
        openPage(2).then( data => {
            return updatePage(data)
        }).then( html => {
            // console.log(html);
            $('.table-data').append(html);
        });
    });

    // Set an interval and call updatePage each seconds.
    // setInterval(function() {
    //     updatePage(false);
    // }, 1000);
}());

function openPage(page) {
    let start = (page * 50) - 50;
    let end = (page * 50) - 1;

    let startDate = 0;

    return promise = new Promise(
        function (resolve, reject) {
            let data = [];
            dbPromise.then(db => {
                let i = 0;
                let tx = db.transaction('session');
                tx.objectStore('session')
                        .iterateCursor(null, 'prev', cursor => {
                            // Stop if cursor is empty or pass the end.
                            if (!cursor || i > end) {return;}

                            // Pass if cursor is before start
                            if(i >= start){

                                // Check if startdate of a data is different
                                if(startDate !== cursor.value.id) {
                                    startDate = cursor.value.id;
                                    data.push({
                                        sDate: cursor.value.id,
                                        eDate: 0,
                                        data: []
                                    });
                                }
                                data[data.length-1].data.push(cursor.value);

                                if(data[data.length-1].eDate < cursor.value.data.update){
                                    data[data.length-1].eDate = cursor.value.data.update;
                                }
                            }
                            i ++;
                            cursor.continue();
                        });

                tx.complete.then(() => {
                    if(data) {
                        resolve(data);
                    } else {
                        reject(new Error('page data is empty'));
                    }
                });
            });
        }
    );
}

function updatePage(datas){
    let id = 0;
    let html = '';

    datas.forEach((sessions, i) => {
        let totalData = 0;
        let totalCached = 0;
        let totalTransferred = 0;

        if(i == 0){
            html += '<tr class=\'table-line\'><td colspan=\'100%\'></td></tr>';
        }
        sessions.data.forEach((data, i) => {
            html += '<tr class=\'table-data-row\'>';

            if(i === 0) {
                // let rowspan = sessions.data.length - 1;
                html += '<td rowspan=\'' + sessions.data.length + '\'>' + moment(sessions.sDate).format('ddd, Do MMM YYYY HH:mm') + '</td>';
            }

            html += '<td>' + data.domain + '</td>';
            html += '<td>' + convertByteTable(data.data.transferred) + '</td>';
            html += '<td>' + convertByteTable(data.data.cachedTransferred) + '</td>';

            let total = data.data.transferred + data.data.cachedTransferred;
            html += '<td>' + convertByteTable(total) + '</td>';
            html += '</tr>';

            totalData += total;
            totalCached += data.data.cachedTransferred;
            totalTransferred += data.data.transferred;
        });

        let dur = sessions.eDate - sessions.sDate;
        html += '<tr class=\'table-data-row\'><td colspan=\'2\'>Session length: ' + moment.duration(dur, 'milliseconds').format('h [hours] m [minutes]') + '</td>';
        html += '<td>' + convertByteTable(totalTransferred) + '</td>';
        html += '<td>' + convertByteTable(totalCached) + '</td>';
        html += '<td>' + convertByteTable(totalData) + '</td></tr>';


        html += '<tr class=\'table-line\'><td colspan=\'100%\'></td></tr>';

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
    return (b/1000000).toFixed(2) + " MB"
}