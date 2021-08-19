const MongoClient = require('mongodb').MongoClient;
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

module.exports = {
    dbUrl: `mongodb://${DB_HOST}:${DB_PORT}/${DB_NAME}`,
    getDb,
    getClient,
}