import moment from "moment";

function normalizeDate(someDate, defaultDate) {
    if (!someDate) {
        return  defaultDate;
    }
    else {
        if (moment.isMoment(someDate)) {
            return someDate;
        }

        try {
            let momentDate = moment(someDate);
            return momentDate && momentDate.isValid()
                ? momentDate
                : defaultDate;
        }
        catch (e) {
            return defaultDate;
        }
    }
}

export {normalizeDate}