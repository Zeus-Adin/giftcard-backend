require('dotenv').config();
const express = require('express')
const { getDb, connectToDb } = require('./db')
const { sendActivationEmail, registerUsersToken } = require('./functions/users')
const { ObjectId } = require('mongodb')
const { default: axios } = require('axios')

// init app & middleware
const app = express()
app.use(express.json())
app.use(cors());

// DB Connection
let db
connectToDb((err) => {
  if (!err) {
    app.listen(process.env.PORT, () => {
      console.log('DB connected at port 3001')
    })
    db = getDb()
  }
})

// Routes
// verify user's info and register info
app.post('/api/register/user/data', (req, res) => {

  const user_data = req.body

  db.collection('users')
    .find({ $or: [{ username: user_data.username }, { contact: user_data.contact }, { email: user_data.email }] })
    .toArray()
    .then(info => {
      console.log(info)
      if (info.length === 0) {
        db.collection('users')
          .insertOne({
            username: user_data.username,
            contact: user_data.contact,
            email: user_data.email,
            pwd: user_data.pwd,
            iconUrl: "/svg/dashboard-avatar.svg",
            balance: 0.00,
            status: ""
          })
          .then(async ({ insertedId: reg_ID }) => {
            const { result: { acknowledged, insertedId }, token } = await registerUsersToken(db)
            const activationKey = insertedId
            if (acknowledged) {
              db.collection('users')
                .updateOne({ _id: ObjectId(reg_ID) }, { $set: { status: activationKey } })
                .then(({ acknowledged }) => {
                  sendActivationEmail(user_data.username, token, `http://localhost:3000/email-verification?activationKey=${activationKey}`, user_data.email)
                  res.status(200).json({ reg_stat: acknowledged, reg_hash: reg_ID, act_key: insertedId })
                })
            } else {
              res.status(500).json({ reg_stat: acknowledged })
            }
          })
          .catch(err => {
            console.log(err)
            res.status(500).json({ error: err, msg: 'registration error' })
          })
      } else {
        res.status(500).json({ username: info[0].username === user_data.username ? true : false, contact: info[0].contact === user_data.contact ? true : false, email: info[0].email === user_data.email ? true : false })
      }

    })
    .catch((err) => {
      res.status(500).json({ error: err, msg: 'there is a malfunction in your request format' })
    })

})
// ----------------------------------------------------------------------------

// resend activation token
app.post('/api/resend/token', (req, res) => {

  const { username } = req.body
  db.collection('users')
    .find({ username: username })
    .toArray()
    .then(info => {
      if (info.length > 0) {
        const { status, email, username } = info[0];
        db.collection('verification')
          .find({ _id: ObjectId(status) })
          .toArray()
          .then(result => {
            if (result.length > 0) {
              const { token, createdAt } = result[0]
              sendActivationEmail(username, `http://localhost:3000/activate/user/${status}/${token}`, email)
              res.status(200).json({ delivered: true, stamp: createdAt })
            } else {
              res.status(400).json({ delivered: false, stamp: createdAt })
            }
          })
      } else {
        res.status(500).json({ reg_stat: false })
      }
    })
})
// ----------------------------------------------------------------------------

// activate user
app.post('api/activate/user', (req, res) => {

  const { activationKey, token: usersToken } = req.body
  db.collection('verification')
    .findOne({ _id: ObjectId(activationKey) })
    .toArray()
    .then(result => {
      if (result.length > 0) {
        const { token } = result[0]
        if (usersToken = token) {
          db.collection('verification')
            .deleteOne({ _id: ObjectId(activationKey) })
            .then(result => {
              if (result.acknowledged) {
                db.collection('users')
                  .updateOne({ _id: ObjectId(usersToken) }, { $set: { status: "active" } })
                  .then(result => {
                    if (result.acknowledged) {
                      res.status(200).json({ activation: true, msg: 'Account activated' })
                    } else {
                      res.status(500).json({ activation: true, msg: 'an error ocured while activating account' })
                    }
                  })
              } else {
                res.status(500).json({ activation: true, msg: 'an error ocured while activating account' })
              }
            })
            .catch(err => {
              res.status(500).json({ error: err, msg: 'an error ocured while activating account' })
            })
        }
      } else {
        res.status(500).json({ activation: false })
      }
    })
})
// ----------------------------------------------------------------------------

// user's login
app.post('/api/user/login', (req, res) => {
  const { username, email, pwd } = req.body
  db.collection('users')
    .findOne({ $or: [{ $and: { username: username, pwd: pwd } }, { $and: { email: email, pwd: pwd } }] })
    .toArray()
    .then(result => {
      if (result.length > 0) {
        res.status(200).json({ authstate: true, result: result, msg: 'Login successfull' })
      } else {
        res.status(500).json({ authstate: false, msg: 'Incorrect user or password.' })
      }
    }).catch(err => {
      res.status(500).json({ authstate: false, msg: 'Unknown error occured' })
    })
})
// ----------------------------------------------------------------------------

// User's password reset
app.post('/api/user/pwd-reset', (req, res) => {
  const { username, email, pwd, new_pwd } = req.body


})
// ----------------------------------------------------------------------------

// forgot password
app.post('/api/user/forgot-pwd', (req, res) => {
  const { username, email } = req.body


})
// ----------------------------------------------------------------------------

app.get('/api/user/info/:username', (req, res) => {
  const { username } = req.params
  db.collection('users')
    .find({ username: username })
    .toArray()
    .then(result => {
      res.status(200).json({ result: result })
    })
    .catch(err => {
      res.status(500).json({ error: err })
    })

})
