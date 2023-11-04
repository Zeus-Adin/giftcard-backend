require('dotenv').config();
const express = require('express')
const { getDb, connectToDb } = require('./db')
const { sendActivationEmail, registerUsersToken, storeCard } = require('./functions/users')
const { ObjectId } = require('mongodb')
const { default: axios } = require('axios')
const cors = require('cors')


// init app & middleware
const app = express()
app.use(express.json({ limit: '10mb' }))
app.use(cors({
  origin: [process.env.APP_ORIGIN, "https://giftcardshop247.netlify.app"]
}))

// DB Connection
let db
connectToDb((err) => {
  if (!err) {
    app.listen(process.env.PORT, () => {
      console.log('DB connected at port ' + process.env.PORT)
    })
    db = getDb()
  }
})

// Routes
// verify user's info and register info
app.post('/api/register/user/data/', (req, res) => {

  const user_data = req.body
  db.collection('users')
    .find({ $or: [{ username: user_data.username }, { contact: user_data.contact }, { email: user_data.email }] })
    .toArray()
    .then(info => {
      if (info.length === 0) {
        db.collection('users')
          .insertOne({
            username: user_data.username, contact: user_data.contact,
            email: user_data.email, pwd: user_data.pwd,
            iconUrl: "/svg/dashboard-avatar.svg", balance: 0.00,
            activationKey: "",
            activation: false
          })
          .then(async ({ insertedId: reg_ID }) => {
            const { result: { acknowledged, insertedId }, token } = await registerUsersToken(db, reg_ID)
            const activationKey = insertedId
            if (acknowledged) {
              db.collection('users')
                .updateOne({ _id: ObjectId(reg_ID) }, { $set: { activationKey: activationKey.toString() } })
                .then(({ acknowledged }) => {
                  sendActivationEmail(user_data.username, token, `${process.env.APP_ORIGIN}/email-verification?actKey=${activationKey}&&email=${user_data.email}`, user_data.email)
                  res.status(200).json({
                    reg_stat: acknowledged, reg_hash: reg_ID,
                    act_key: insertedId, message: "Registration successful!",
                    reg_payload: {
                      username: false,
                      contact: false,
                      email: false
                    }
                  })
                })
            } else {
              res.status(500).json({ reg_stat: acknowledged })
            }
          })
          .catch(err => {
            console.log(err)
            res.status(500).json({ reg_stat: false, error: err, message: 'Token generation server side error!' })
          })
      } else {
        res.status(500).json({
          reg_stat: false, reg_hash: "",
          act_key: "", message: "Registration failed!",
          reg_payload: {
            username: info[0].username === user_data.username ? true : false,
            contact: info[0].contact === user_data.contact ? true : false,
            email: info[0].email === user_data.email ? true : false
          }
        })
      }
    })
    .catch((error) => {
      console.log(error)
      res.status(500).json({ reg_stat: false, error: error, message: 'User registeration server side error!' })
    })

})
// ----------------------------------------------------------------------------

// activate user
app.post('/api/activate/user/:id', (req, res) => {

  const { token: usersToken } = req.body;
  db.collection('verification')
    .find({ _id: ObjectId(req.params.id) })
    .toArray()
    .then(async result => {
      if (result.length === 0) res.status(500).json({ verify_stat: false, message: 'Activation token expired!' })

      const { token, reg_id } = result[0]
      if (token === usersToken) {
        const { acknowledged } = await db.collection('users').updateOne({ _id: ObjectId(reg_id) }, { $set: { activation: true, activationKey: '' } })
        if (acknowledged) {
          db.collection('verification').deleteOne({ _id: ObjectId(req.params.id) })
          res.status(200).json({ verify_stat: true, message: 'Account activation successful!' })
        }
        if (!acknowledged) res.status(500).json({ verify_stat: false, message: 'Unknown error occured!' })
      } else {
        res.status(500).json({ verify_stat: false, message: 'Invalid token provided!' })
      }
    }).catch(error => res.status(500).json({ verify_stat: false, message: 'Db server side error!', error: error }))
})

// ----------------------------------------------------------------------------

// resend activation token
app.post('/api/resend/token/', (req, res) => {
  const { email } = req.body
  db.collection('users').find({ email: email })
    .toArray()
    .then(async userInfo => {
      if (!userInfo) {
        return res.status(404).json({ resend_stat: false, message: "User not found!" });
      }

      const { _id: users_reg_id, activation, activationKey, email, username } = userInfo[0];
      const verificationInfo = await db.collection('verification').findOne({ _id: activationKey });

      if (!verificationInfo) {
        const { result: { acknowledged, insertedId }, token } = await registerUsersToken(db, users_reg_id);

        if (!acknowledged) {
          return res.status(500).json({ resend_stat: false, message: 'Unknown error occurred' });
        }

        await db.collection('users').updateOne({ _id: ObjectId(users_reg_id) }, { $set: { activationKey: insertedId } });
        sendActivationEmail(username, token, `${process.env.APP_ORIGIN}/email-verification?actKey=${insertedId}&&email=${email}`, email);
        return res.status(200).json({ resend_stat: true, message: 'Verification code sent' });
      }

      const { token } = verificationInfo;

      if (activation) {
        return res.status(500).json({ resend_stat: false, message: 'Account has been activated already' });
      }

      sendActivationEmail(username, token, `${process.env.APP_ORIGIN}/email-verification?actKey=${activationKey}&&email=${email}`, email);
      return res.status(200).json({ resend_stat: true, message: 'Verification code sent' });
    })
    .catch(error => {
      res.status(500).json({ resend_stat: false, message: 'Server side error', error: error });
    })
});

// ----------------------------------------------------------------------------

// user's login
app.post('/api/user/login', (req, res) => {
  const { email, pwd } = req.body
  console.log(email, pwd)
  db.collection('users')
    .find({ email: email, pwd: pwd })
    .toArray()
    .then(result => {
      if (result.length > 0) {
        res.status(200).json({ authstate: true, result: result, message: 'Login successfull' })
      } else {
        res.status(500).json({ authstate: false, result: result, message: 'Incorrect user or password.' })
      }
    }).catch(error => {
      res.status(500).json({ authstate: false, result: [], message: 'Unknown error occured', error: error })
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
  const { email } = req.body


})
// ----------------------------------------------------------------------------

// Get user info
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
// ----------------------------------------------------------------------------

// Register card tx
app.post('/api/register/giftcard/tx', async (req, res) => {
  console.log('fired')
  const { user, amount, fileCount, files, ecode, rate, status } = req.body;
  const { acknowledged, insertedId } = await db.collection('cards').insertOne({ id: user.id, username: user.username, amount: amount, fileCount: fileCount, rate: rate, status: status, files: [], ecode: ecode })
  if (!acknowledged) res.status(500).json({ regTx: acknowledged, message: 'Gift card register failed!', result })
  const saveCards = await storeCard(files, insertedId)
  if (saveCards === none) res.status(500).json({ regTx: false, message: 'Gift card image upload failed!', result })
  const result = await db.collection('cards').updateOne({ _id: ObjectId(insertedId) }, { $set: { files: saveCards } })
  res.status(200).json({ regTx: true, message: 'Gift card sale request sent successful!', result })
})
// -----------------------------------------------------------------------------

