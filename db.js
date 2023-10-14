require('dotenv').config();
const { MongoClient } = require('mongodb')

let dbConnection

module.exports = {
  connectToDb: (cb) => {
    MongoClient.connect(process.env.DB_CONNECTION_URL)
      .then(client => {
        dbConnection = client.db('gift-shop')
        return cb()
      })
      .catch(err => {
        console.log(err)
        return cb(err)
      })
  },
  getDb: () => dbConnection
}