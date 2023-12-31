require('dotenv').config();
const express = require('express')
const { getDb, connectToDb } = require('./db')
const {
  userRegistration, activateUser, resendUserActivationToken, login, getUserInfo, userBalanceWithdrawal, getUsersOrder, getUsersPin, updateUsersTxPin, resetPassword, updatePassword
} = require('./functions/users')
const { ObjectId } = require('mongodb')
const cors = require('cors');
const { saveCardTx, getCardTx } = require('./functions/cardTx');
const { adminGetAllUsers, adminGetAllCardtx, adminGetAllOrder, adminGetAllBank, adminUpdateRate, adminUpdateBalance, adminUpdateCardData, adminUpdateOder } = require('./functions/admin');
const { regUsersBankDetails } = require('./functions/bank');
const { getAllRates } = require('./functions/rate');
const { getCard } = require('./functions/cardTxImages');

let date = new Date();
date = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
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
  userRegistration(req.body, db, res)
})
// ----------------------------------------------------------------------------

// activate user
app.post('/api/activate/user', (req, res) => {
  activateUser(req.body, db, res)
})
// ----------------------------------------------------------------------------

// resend activation token
app.post('/api/resend/token/', (req, res) => {
  resendUserActivationToken(req.body, db, res)
  console.log('Fired again')
});

// ----------------------------------------------------------------------------

// user's login
app.post('/api/user/login', (req, res) => {
  login(req.body, db, res)
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
  getUserInfo(req.params, db, res)
})
// ----------------------------------------------------------------------------

// Register card tx
app.post('/api/register/giftcard/tx', async (req, res) => {
  saveCardTx(req.body, db, res)
})
// -----------------------------------------------------------------------------

// Get cards
app.get('/api/get/giftcard/:username/:id', async (req, res) => {
  getCardTx(req.params, db, res)
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
  regUsersBankDetails(req.body, db, res)
})
// -----------------------------------------------------------------------------

// Create Pin
app.post('/api/create/pin', async (req, res) => {
  const { userId, username, txpin } = req.body
  const userData = await db.collection('users').find({ $and: [{ _id: ObjectId(userId) }, { username: username }] }).toArray();
  if (userData.length === 0) res.status(500).json({ txStat: false, message: 'User not registered!', userInfo: userData });
  const { acknowledged } = await db.collection('users').updateOne({ $and: [{ _id: ObjectId(userId) }, { username: username }] }, { $set: { txpin: txpin } })
  if (acknowledged) {
    res.status(200).json({ txRegStat: true, message: 'Pin created successfully!', userInfo: userData[0] });
  } else {
    res.status(500).json({ txRegStat: false, message: 'Server error!' });
  }
})
// -----------------------------------------------------------------------------

// Update Pin
app.post('/api/update/pin', async (req, res) => {
  const { userId, username, txpin, newTxpin } = req.body
  const userData = await db.collection('users').find({ $and: [{ _id: ObjectId(userId) }, { username: username }] }).toArray();
  if (userData.length === 0) res.status(500).json({ txStat: false, message: 'User not registered!', userInfo: userData });
  if (userData[0].txpin !== txpin) res.status(500).json({ txStat: false, message: 'Wrong txpin!' });
  const { acknowledged } = await db.collection('users').updateOne({ $and: [{ _id: ObjectId(userId) }, { username: username }] }, { $set: { txpin: newTxpin } })
  if (acknowledged) {
    res.status(200).json({ txUpdateStat: true, message: 'Pin updated successfully!', userInfo: userData[0] });
  } else {
    res.status(500).json({ txUpdateStat: false, message: 'Server error!' });
  }
})
// -----------------------------------------------------------------------------

// Get Rates
app.get('/api/get/rates', async (req, res) => {
  getAllRates(db, res)
})
// -----------------------------------------------------------------------------

// Balance withdraw
app.post('/api/balance/withdraw', async (req, res) => {
  userBalanceWithdrawal(req.body, db, res)
})
// -----------------------------------------------------------------------------

// Balance withdraw
app.get('/api/orders/:userId/:username', async (req, res) => {
  getUsersOrder(req.params, db, res)
})
// -----------------------------------------------------------------------------

// getUsers txpin
app.post('/api/get/txpin', async (req, res) => {
  getUsersPin(req.body, db, res)
})
// -----------------------------------------------------------------------------

// Update txpin
app.post('/api/update/txpin', async (req, res) => {
  updateUsersTxPin(req.body, db, res)
})
// -----------------------------------------------------------------------------

// Update password
app.post('/api/update/password', async (req, res) => {
  updatePassword(req.body, db, res)
})
// -----------------------------------------------------------------------------


// Adming routes
app.post('/api/get/all/users', async (req, res) => {
  adminGetAllUsers(req.body, db, res)
})
// -----------------------------------------------------------------------------
app.post('/api/get/all/cardtx', async (req, res) => {
  adminGetAllCardtx(req.body, db, res)
})
// -----------------------------------------------------------------------------
app.post('/api/get/all/orders', async (req, res) => {
  adminGetAllOrder(req.body, db, res)
})
// -----------------------------------------------------------------------------
app.post('/api/get/all/banks', async (req, res) => {
  adminGetAllBank(req.body, db, res)
})
// -----------------------------------------------------------------------------
app.post('/api/update/rates', async (req, res) => {
  adminUpdateRate(req.body, db, res)
})
// -----------------------------------------------------------------------------
app.post('/api/update/amount', async (req, res) => {
  adminUpdateBalance(req.body, db, res)
})
// -----------------------------------------------------------------------------
app.post('/api/update/cardtx/data', async (req, res) => {
  adminUpdateCardData(req.body, db, res)
})
// -----------------------------------------------------------------------------
app.post('/api/update/order/status', async (req, res) => {
  adminUpdateOder(req.body, db, res)
})
// -----------------------------------------------------------------------------
