require('dotenv').config();
const express = require('express')
const { getDb, connectToDb } = require('./db')
const { sendActivationEmail, registerUsersToken, storeCard, getCard } = require('./functions/users')
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
app.post('/api/register/user/data/', async (req, res) => {

  const { username, contact, email, pwd } = req.body;
  try {
    const regPayload = {
      username: username,
      firstname: "",
      lastname: "",
      contact: contact,
      bvn: "",
      email: email,
      pwd: pwd,
      txpin: "",
      balance: 0.00,
      activationKey: "",
      activation: false,
      avatarIcon: "/svg/dashboard-avatar.svg"
    }
    // Response
    function returnResPayload(responseStat, act_key, reg_stat, reg_hash, message, reg_payload) {
      res.status(responseStat).json({ reg_stat, act_key, reg_hash, message, reg_payload })
    }

    // Check if RegDetails Exists
    const verifyRegDetails = await db.collection('users').find({ $or: [{ username }, { contact }, { email }] }).toArray()
    if (verifyRegDetails.length > 0) {
      const { username: existUsername, contact: existContact, email: existEmail } = verifyRegDetails[0];
      returnResPayload(500, "", false, "", "Registration failed!", { username: existUsername === username, contact: existContact === contact, email: existEmail === email })
    }

    if (verifyRegDetails.length === 0) {
      const { insertedId: regId, acknowledged } = await db.collection('users').insertOne(regPayload)
      if (acknowledged) {
        const { result: { acknowledged: tokenStat, insertedId: tokenRegId }, token } = await registerUsersToken(db, regId)
        const activationKey = tokenRegId
        const { acknowledged: tokenRegStat } = await db.collection('users').updateOne({ _id: ObjectId(regId) }, { $set: { activationKey: activationKey.toString() } })
        if (tokenRegStat, tokenStat) {
          sendActivationEmail(username, token, `${process.env.APP_ORIGIN}/email-verification?actKey=${activationKey}&&email=${email}`, email)
          returnResPayload(200, activationKey, acknowledged, regId, "Registration successful!", { username: true, contact: true, email: true })
        } else {
          returnResPayload(500, activationKey, acknowledged, regId, "Token Generation Error!", { username: true, contact: true, email: true })
        }
      } else {
        returnResPayload(500, "", acknowledged, regId, "Registration failed!", { username: false, contact: false, email: false })
      }
    }
  } catch (error) {
    console.log(error)
  }

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
  const { user, amount, fileCount, files, ecode, rate, status, currency } = req.body;
  const { acknowledged, insertedId } = await db.collection('cards').insertOne({ id: user.id, username: user.username, currency: currency, amount: amount, fileCount: fileCount, rate: rate, status: status, files: "", ecode: ecode })
  if (!acknowledged) res.status(500).json({ regTx: acknowledged, message: 'Gift card register failed!', result })
  const saveCards = await storeCard(files, insertedId)
  if (saveCards === 'none') res.status(500).json({ regTx: false, message: 'Gift card image upload failed!', result })
  const result = await db.collection('cards').updateOne({ _id: ObjectId(insertedId) }, { $set: { files: saveCards } })
  res.status(200).json({ regTx: true, message: 'Gift card sale request sent successful!', result })
})
// -----------------------------------------------------------------------------

// Get cards
app.get('/api/get/giftcard/:username/:id', async (req, res) => {
  const { username, id } = req.params
  const cardTx = await db.collection('cards').find({ $or: [{ id: id }, { username: username }] }).toArray()
  if (cardTx.length === 0) res.status(500).json({ success: false, message: 'Card not found', result: cardTx })
  let results = [];
  for (let i = 0; i < cardTx.length; i++) {
    const { success, message, error, result } = await getCard(cardTx[i].files)
    results.push({ success, message, error, url: result, tx: cardTx[i] })
  }
  res.status(200).json({ results })
})
// -----------------------------------------------------------------------------

// Get card
app.get('/api/get/giftcard/:cid', async (req, res) => {
  const { cid } = req.params
  const cardTx = await db.collection('cards').find({ files: cid }).toArray()
  if (!cardTx) res.status(500).json({ success: false, message: 'Cardtx not found', result: cardTx })
  const { success, message, error, result } = await getCard(cid)
  res.status(200).json({ success, message, error, url: result, tx: cardTx[0] })
})
// -----------------------------------------------------------------------------

// Get Bank Info
app.get('/api/get/bank/info/:id/:username', async (req, res) => {
  const { id, username } = req.params;
  const bankInfo = await db.collection('bank').find({ $and: [{ id: id }, { username: username }] }).toArray();
  res.status(200).json({ accounts: bankInfo });
})
// -----------------------------------------------------------------------------

// Register Bank
app.post('/api/register/bank/info', async (req, res) => {
  const info = req.body;
  const bankInfo = await db.collection('bank').find({ $and: [{ id: info.id }, { username: info.username }] }).toArray();
  for (let i = 0; i < bankInfo.length; i++) {
    if (bankInfo[i].account_number === info.account_number) res.status(500).json({ bankReg: false, message: 'Account already exists!' });
  }
  if (bankInfo.length === 5) res.status(500).json({ bankReg: false, message: 'Allowed number of banks reached!' });
  const { acknowledged } = await db.collection('bank').insertOne(info)
  if (acknowledged) {
    res.status(200).json({ bankReg: true, message: 'Bank add successfully!' });
  } else {
    res.status(500).json({ bankReg: false, message: 'Server error!' });
  }
})
// -----------------------------------------------------------------------------

// Create Pin
app.post('/api/create/pin', async (req, res) => {
  const { userId, username, txpin } = req.body
  const userData = await db.collection().find({ $and: [{ _id: ObjectId(userId) }, { username: username }] }).toArray();
  if (userData.length === 0) res.status(500).json({ txStat: false, message: 'User not registered!' });
  const { acknowledged } = await db.collection('users').updateOne({ $and: [{ _id: ObjectId(userId) }, { username: username }] }, { $set: { txpin: txpin } })
  if (acknowledged) {
    res.status(200).json({ txStat: true, message: 'Pin created successfully!', userData: userData[0] });
  } else {
    res.status(500).json({ txStat: false, message: 'Server error!' });
  }
})
// -----------------------------------------------------------------------------
