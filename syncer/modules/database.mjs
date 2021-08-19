import {MongoClient} from "mongodb";

const DB_HOST = process.env.MONGO_HOST;
const DB_NAME = process.env.MONGO_DB;
const DB_PORT = process.env.MONGO_PORT || 27017;

let clientInstance = {};
let dbInstance = {};

async function newClient(dbName = false) {
    if (!dbName) {
        dbName = DB_NAME;
    }

    let dbUrl = `mongodb://${DB_HOST}:${DB_PORT}/${dbName}`;
    let client = await MongoClient.connect(dbUrl, {useNewUrlParser: true, useUnifiedTopology: true});
    return client;
}

async function newDb(dbName = false) {
    if (!dbName) {
        dbName = DB_NAME;
    }

    let client = await getClient(dbName);
    let db = client.db(dbName);
    return db;
}

async function getClient (dbName = false) {
    if (!dbName) {
        dbName = DB_NAME;
    }

    if (clientInstance[dbName]) {
        return clientInstance[dbName];
    }

    clientInstance[dbName] = await newClient();
    return clientInstance[dbName];
}

async function getDb (dbName = false) {
    if (!dbName) {
        dbName = DB_NAME;
    }

    if (dbInstance[dbName]) {
        return dbInstance[dbName];
    }

    dbInstance[dbName] = await newDb(dbName);
    return dbInstance[dbName];
}

function checkItemChanged(receivedVersion, savedVersion, checkUpdatedFieldName) {
    return savedVersion[checkUpdatedFieldName] !== receivedVersion[checkUpdatedFieldName];
}

async function syncCollectionItems(db, receivedItems, collectionName, idFieldName, checkUpdatedFieldName) {
    let receivedIds = receivedItems.map(item => item[idFieldName]);
    let dbCollection = db.collection(collectionName);

    let query = {};
    query[idFieldName] = {$in: receivedIds};
    let savedItems = await dbCollection.find(query).toArray();
    let savedIds = savedItems.map(item => item[idFieldName]);

    let newItems = receivedItems.filter( item => savedIds.indexOf(item[idFieldName]) === -1 );
    let updatedItems = receivedItems
        .filter(receivedVersion => {
            let itemId = receivedVersion[idFieldName];
            let hasNoSavedVersion = savedIds.indexOf(itemId) === -1;
            if (hasNoSavedVersion) {
                return false;
            }

            let savedVersion = savedItems.find(item => item[idFieldName] === itemId);
            let isUpdated = checkItemChanged(receivedVersion, savedVersion, checkUpdatedFieldName);
            return isUpdated;
        });

    let isSuccess = true;

    if (newItems && newItems.length > 0) {
        try {
            await dbCollection.insertMany(newItems);
        }
        catch (e) {
            isSuccess = false;
        }
    }

    for (let updatedItem of updatedItems) {
        let searchQuery = {};
        searchQuery[idFieldName] = updatedItem[idFieldName];
        try {
            await dbCollection.updateOne(searchQuery, {$set: updatedItem});
        }
        catch (e) {
            isSuccess = false;
        }
    }

    return isSuccess;
}

export {getDb, getClient, syncCollectionItems};