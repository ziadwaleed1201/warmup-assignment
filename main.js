const fs = require("fs");

// ---------- Helper Functions ----------

function time12ToSeconds(timeStr) {
    timeStr = timeStr.trim();
    let [time, period] = timeStr.split(" ");
    let [h, m, s] = time.split(":").map(Number);

    if (period === "pm" && h !== 12) h += 12;
    if (period === "am" && h === 12) h = 0;

    return h * 3600 + m * 60 + s;
}

function hmsToSeconds(str) {
    let [h, m, s] = str.split(":").map(Number);
    return h * 3600 + m * 60 + s;
}

function secondsToHMS(sec) {
    let h = Math.floor(sec / 3600);
    sec %= 3600;
    let m = Math.floor(sec / 60);
    let s = sec % 60;

    return `${h}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}

function secondsToHHH(sec){
    let h = Math.floor(sec/3600);
    sec %=3600;
    let m = Math.floor(sec/60);
    let s = sec%60;

    return `${h}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}

// ============================================================
// Function 1
// ============================================================
function getShiftDuration(startTime, endTime) {
    let start = time12ToSeconds(startTime);
    let end = time12ToSeconds(endTime);
    return secondsToHMS(end - start);
}

// ============================================================
// Function 2
// ============================================================
function getIdleTime(startTime, endTime) {

    let start = time12ToSeconds(startTime);
    let end = time12ToSeconds(endTime);

    let deliveryStart = 8 * 3600;
    let deliveryEnd = 22 * 3600;

    let idle = 0;

    if(start < deliveryStart)
        idle += Math.min(end, deliveryStart) - start;

    if(end > deliveryEnd)
        idle += end - Math.max(start, deliveryEnd);

    return secondsToHMS(idle);
}

// ============================================================
// Function 3
// ============================================================
function getActiveTime(shiftDuration, idleTime) {
    let shift = hmsToSeconds(shiftDuration);
    let idle = hmsToSeconds(idleTime);

    return secondsToHMS(shift - idle);
}

// ============================================================
// Function 4
// ============================================================
function metQuota(date, activeTime) {

    let active = hmsToSeconds(activeTime);

    let eidStart = new Date("2025-04-10");
    let eidEnd = new Date("2025-04-30");
    let d = new Date(date);

    let quota;

    if(d >= eidStart && d <= eidEnd)
        quota = 6*3600;
    else
        quota = 8*3600 + 24*60;

    return active >= quota;
}

// ============================================================
// Function 5
// ============================================================
function addShiftRecord(textFile, shiftObj) {

    let data = fs.readFileSync(textFile,"utf8").trim();
    let rows = data.split("\n");

    for(let row of rows){
        let cols = row.split(",");
        if(cols[0] === shiftObj.driverID && cols[2] === shiftObj.date)
            return {};
    }

    let shiftDuration = getShiftDuration(shiftObj.startTime, shiftObj.endTime);
    let idleTime = getIdleTime(shiftObj.startTime, shiftObj.endTime);
    let activeTime = getActiveTime(shiftDuration, idleTime);
    let quota = metQuota(shiftObj.date, activeTime);

    let newRecord = {
        driverID: shiftObj.driverID,
        driverName: shiftObj.driverName,
        date: shiftObj.date,
        startTime: shiftObj.startTime,
        endTime: shiftObj.endTime,
        shiftDuration,
        idleTime,
        activeTime,
        metQuota: quota,
        hasBonus: false
    };

    let line = [
        newRecord.driverID,
        newRecord.driverName,
        newRecord.date,
        newRecord.startTime,
        newRecord.endTime,
        newRecord.shiftDuration,
        newRecord.idleTime,
        newRecord.activeTime,
        newRecord.metQuota,
        newRecord.hasBonus
    ].join(",");

    let index = -1;

    for(let i=rows.length-1;i>=0;i--){
        if(rows[i].split(",")[0] === shiftObj.driverID){
            index = i;
            break;
        }
    }

    if(index === -1)
        rows.push(line);
    else
        rows.splice(index+1,0,line);

    fs.writeFileSync(textFile, rows.join("\n"));

    return newRecord;
}

// ============================================================
// Function 6
// ============================================================
function setBonus(textFile, driverID, date, newValue) {

    let rows = fs.readFileSync(textFile,"utf8").trim().split("\n");

    for(let i=0;i<rows.length;i++){

        let cols = rows[i].split(",");

        if(cols[0] === driverID && cols[2] === date){
            cols[9] = newValue.toString();
            rows[i] = cols.join(",");
            break;
        }
    }

    fs.writeFileSync(textFile, rows.join("\n"));
}

// ============================================================
// Function 7
// ============================================================
function countBonusPerMonth(textFile, driverID, month) {

    let rows = fs.readFileSync(textFile, "utf8").trim().split("\n");

    let found = false;
    let count = 0;

    month = parseInt(month);

    for (let row of rows) {

        let cols = row.split(",");

        if (cols[0] === driverID) {

            found = true;

            let m = parseInt(cols[2].split("-")[1]);

            let bonus = cols[9].trim().toLowerCase();

            if (m === month && bonus === "true")
                count++;
        }
    }

    if (!found) return -1;

    return count;
}

// ============================================================
// Function 8
// ============================================================
function getTotalActiveHoursPerMonth(textFile, driverID, month) {

    let rows = fs.readFileSync(textFile,"utf8").trim().split("\n");

    let total = 0;

    for(let row of rows){

        let cols = row.split(",");

        if(cols[0] === driverID){

            let m = parseInt(cols[2].split("-")[1]);

            if(m === month)
                total += hmsToSeconds(cols[7]);
        }
    }

    return secondsToHHH(total);
}

// ============================================================
// Function 9
// ============================================================
function getRequiredHoursPerMonth(textFile, rateFile, bonusCount, driverID, month) {

    let shifts = fs.readFileSync(textFile,"utf8").trim().split("\n");
    let rates = fs.readFileSync(rateFile,"utf8").trim().split("\n");

    let dayOff;

    for(let r of rates){
        let c = r.split(",");
        if(c[0] === driverID){
            dayOff = c[1];
            break;
        }
    }

    let total = 0;

    for(let row of shifts){

        let cols = row.split(",");

        if(cols[0] === driverID){

            let date = cols[2];
            let m = parseInt(date.split("-")[1]);

            if(m === month){

                let d = new Date(date);
                let weekday = d.toLocaleDateString("en-US",{weekday:"long"});

                if(weekday === dayOff) continue;

                let quota;

                if(d >= new Date("2025-04-10") && d <= new Date("2025-04-30"))
                    quota = 6*3600;
                else
                    quota = 8*3600 + 24*60;

                total += quota;
            }
        }
    }

    total -= bonusCount * 2 * 3600;

    if(total < 0) total = 0;

    return secondsToHHH(total);
}

// ============================================================
// Function 10
// ============================================================
function getNetPay(driverID, actualHours, requiredHours, rateFile) {

    let rates = fs.readFileSync(rateFile,"utf8").trim().split("\n");

    let basePay, tier;

    for(let r of rates){
        let c = r.split(",");
        if(c[0] === driverID){
            basePay = parseInt(c[2]);
            tier = parseInt(c[3]);
            break;
        }
    }

    let actual = hmsToSeconds(actualHours);
    let required = hmsToSeconds(requiredHours);

    if(actual >= required) return basePay;

    let missing = required - actual;

    let allowance = {
        1:50,
        2:20,
        3:10,
        4:3
    }[tier];

    missing -= allowance*3600;

    if(missing <= 0) return basePay;

    let billable = Math.floor(missing/3600);

    let deductionRate = Math.floor(basePay/185);

    let deduction = billable * deductionRate;

    return basePay - deduction;
}

module.exports = {
    getShiftDuration,
    getIdleTime,
    getActiveTime,
    metQuota,
    addShiftRecord,
    setBonus,
    countBonusPerMonth,
    getTotalActiveHoursPerMonth,
    getRequiredHoursPerMonth,
    getNetPay
};