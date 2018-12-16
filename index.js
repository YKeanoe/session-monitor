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

    dbPromise.then(db => {
        return db.transaction('session')
            .objectStore('session').getAll();
    }).then(
        allObjs => console.log(allObjs)
    );

    document.addEventListener("DOMContentLoaded", function() {
        openPage(1).then( data => {
            return;
            //  updatePage(data)
        }).then( html => {
            // console.log(html);
            $('.table-data').append(html);
            return;
        }).then(() => {
            $('.top-group-data').on('click', function(e){
                console.log($(this).attr('target'));
            })
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

                                /**
                                 * Check if startdate of a data is different.
                                 * If it is different, means cursor is at a new
                                 * session. it will create a new data object.
                                 *  */
                                if(startDate !== cursor.value.id) {
                                    startDate = cursor.value.id;
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

    datas.forEach( (sessions, i) => {
        let totalData = 0;
        let totalCached = 0;
        let totalTransferred = 0;

        let groupIndex = i + 1;

        html += '<tbody>';

        sessions.data.forEach((data, j) => {
            if(j === 0) {
                html += '<tr class=\'table-data-row top-group-data\' target=\'group-' + groupIndex + '\'>';
                html += '<td col-span=\'2\'>' + moment(sessions.sDate).format('ddd, Do MMM YYYY HH:mm') + '</td>';
                html += '<td></td>';
                html += '<td>' + convertByteTable(sessions.transferredTotal) + '</td>';
                html += '<td>' + convertByteTable(sessions.cacheTotal) + '</td>';
                html += '<td>' + convertByteTable((sessions.transferredTotal + sessions.cacheTotal)) + '</td>';
                html += '</tr>';
                html += '</tbody>';

                html += '<tbody id=\'group-' + groupIndex + '\'>';
            }
            html += '<tr class=\'table-data-row\'>';

            html += '<td><div></div></td>';
            html += '<td><div>' + data.domain + '</td>';
            html += '<td><div>' + convertByteTable(data.data.transferred) + '</div></td>';
            html += '<td><div>' + convertByteTable(data.data.cachedTransferred) + '</div></td>';

            let total = data.data.transferred + data.data.cachedTransferred;
            html += '<td><div>' + convertByteTable(total) + '</div></td>';
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
        html += '</tbody>';

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
    return (b/1000000).toFixed(3) + " MB"
}