const { ObjectId } = require("mongodb");

module.exports = {
    adminGetAllUsers: async (reqOptions, db, res) => {
        try {
            const { userId, username } = reqOptions
            const adminData = await db.collection('users').find({ $and: [{ _id: ObjectId(userId) }, { username: username }] }).toArray()
            if (adminData.length === 0) { res.status(500).json({ authState: false, message: 'User not found!' }); return }
            const { admin, activation } = adminData[0]
            if (!(admin && activation)) { res.status(500).json({ authState: false, message: 'Unauthorized user!' }); return }
            const allUsers = await db.collection('users').find({}).toArray()
            const { pwd, txpin, ...strippedUser } = allUsers;
            let result = [];
            for (let i = 0; i < allUsers.length; i++) {
                const { pwd, txpin, ...strippedUser } = allUsers[i]
                result.push(strippedUser)
            }
            res.status(200).json({ authState: true, message: 'success users', result })
        } catch (err) {
            res.status(200).json({ authState: false, message: err.message, result: [] })
        }
    },
    adminGetAllCardtx: async (reqOptions, db, res) => {
        try {
            const { userId, username } = reqOptions
            const adminData = await db.collection('users').find({ $and: [{ _id: ObjectId(userId) }, { username: username }] }).toArray()
            if (adminData.length === 0) { res.status(500).json({ authState: false, message: 'User not found!' }); return }
            const { admin, activation } = adminData[0]
            if (!(admin && activation)) { res.status(500).json({ authState: false, message: 'Unauthorized user!' }); return }
            const allCardTxs = await db.collection('cards').find({ status: "pending" }).toArray()
            res.status(200).json({ authState: true, message: 'success cardtx', result: allCardTxs })
        } catch (err) {
            res.status(200).json({ authState: false, message: err.message, result: [] })
        }
    },
    adminGetAllOrder: async (reqOptions, db, res) => {
        try {
            const { userId, username } = reqOptions
            const adminData = await db.collection('users').find({ $and: [{ _id: ObjectId(userId) }, { username: username }] }).toArray()
            if (adminData.length === 0) { res.status(500).json({ authState: false, message: 'User not found!' }); return }
            const { admin, activation } = adminData[0]
            if (!(admin && activation)) { res.status(500).json({ authState: false, message: 'Unauthorized user!' }); return }
            const allOrders = await db.collection('orders').find({ status: "pending" }).toArray()
            res.status(200).json({ authState: true, message: 'success orders', result: allOrders })
        } catch (err) {
            res.status(200).json({ authState: false, message: err.message, result: [] })
        }
    },
    adminGetAllBank: async (reqOptions, db, res) => {
        try {
            const { userId, username } = reqOptions
            const adminData = await db.collection('users').find({ $and: [{ _id: ObjectId(userId) }, { username: username }] }).toArray()
            if (adminData.length === 0) { res.status(500).json({ authState: false, message: 'User not found!' }); return }
            const { admin, activation } = adminData[0]
            if (!(admin && activation)) { res.status(500).json({ authState: false, message: 'Unauthorized user!' }); return }
            const allOrders = await db.collection('bank').find({}).toArray()
            res.status(200).json({ authState: true, message: 'success banks', result: allOrders })
        } catch (err) {
            res.status(200).json({ authState: false, message: err.message, result: [] })
        }
    },
    adminUpdateRate: async (reqOptions, db, res) => {
        try {
            const { userId, username, currency, amount } = reqOptions;
            console.log(reqOptions)

            const adminData = await db.collection('users').findOne({ _id: ObjectId(userId), username });

            if (!adminData) {
                return res.status(500).json({ authState: false, message: 'User not found!' });
            }

            const { admin, activation } = adminData;

            if (!(admin && activation)) {
                return res.status(500).json({ authState: false, message: 'Unauthorized user!' });
            }

            const rates = await db.collection('rate').find({ [currency]: { $exists: true } }).toArray();
            console.log(rates)
            if (rates.length > 0) {
                const { _id: rateId } = rates[0];
                const { acknowledged, modifiedCount } = await db.collection('rate').updateOne(
                    { _id: rateId },
                    { $set: { [currency]: parseInt(amount) } }
                );

                if (acknowledged && modifiedCount > 0) {
                    return res.status(200).json({ rateUpdateState: acknowledged, message: `Rate ${currency} updated successfully!` });
                }
            } else {
                const { acknowledged } = await db.collection('rate').insertOne({ [currency]: parseInt(amount) });

                if (acknowledged) {
                    return res.status(200).json({ rateUpdateState: acknowledged, message: `Rate ${currency} added successfully!` });
                }
            }

            return res.status(500).json({ rateUpdateState: false, message: `Rate ${currency} with amount ${amount} exists!` });
        } catch (err) {
            return res.status(500).json({ rateUpdateState: false, message: err.message });
        }

    },
    adminUpdateBalance: async (reqOptions, db, res) => {
        const { adminId, adminUsername, userId, username, amount } = reqOptions
        try {
            const adminData = await db.collection('users').findOne({ _id: ObjectId(adminId), username: adminUsername });

            if (!adminData) {
                return res.status(500).json({ authState: false, message: 'User not found!' });
            }

            const { admin, activation } = adminData;
            if (!(admin && activation)) {
                return res.status(500).json({ authState: false, message: 'Unauthorized user!' });
            }

            const { acknowledged } = await db.collection('users').updateOne({ _id: ObjectId(userId), username: username }, { $set: { balance: parseFloat(amount) } })
            if (acknowledged) {
                return res.status(200).json({ balanceUpdateState: acknowledged, message: 'Users balance has been updated to ' + amount })
            }
            res.status(200).json({ balanceUpdateState: false, message: 'This action failed, with an unknown error relating to db ' })
        } catch (error) {
            return res.status(200).json({ balanceUpdateState: false, message: error.message })
        }
    },
    adminUpdateCardData: async (reqOptions, db, res) => {
        const { adminId, adminUsername, cardTxRef, username, status, confirmedFileCount, reason } = reqOptions
        try {
            const adminData = await db.collection('users').findOne({ _id: ObjectId(adminId), username: adminUsername });

            if (!adminData) {
                return res.status(500).json({ authState: false, message: 'User not found!' });
            }

            const { admin, activation } = adminData;
            if (!(admin && activation)) {
                return res.status(500).json({ authState: false, message: 'Unauthorized user!' });
            }

            const { acknowledged } = await db.collection('cards').updateOne({ _id: ObjectId(cardTxRef), userName: username }, { $set: { status: status, fileCount: confirmedFileCount, reason: reason } });
            if (acknowledged) {
                return res.status(200).json({ cardState: acknowledged, message: "CardTx update success!" })
            } else {
                return res.status(500).json({ cardState: acknowledged, message: "CardTx update failed!" })
            }

        } catch (error) {
            return res.status(200).json({ cardState: acknowledged, message: error.message })
        }
    },
    adminUpdateOder: async (reqOptions, db, res) => {
        const { adminId, adminUsername, orderRef, username, status } = reqOptions
        try {
            const adminData = await db.collection('users').findOne({ _id: ObjectId(adminId), username: adminUsername });

            if (!adminData) {
                return res.status(500).json({ authState: false, message: 'User not found!' });
            }

            const { admin, activation } = adminData;
            if (!(admin && activation)) {
                return res.status(500).json({ authState: false, message: 'Unauthorized user!' });
            }

            const { acknowledged } = await db.collection('orders').updateOne({ _id: ObjectId(orderRef), userName: username }, { $set: { status: status } });
            if (acknowledged) {
                return res.status(200).json({ orderState: acknowledged, message: "Order status update success!" })
            } else {
                return res.status(500).json({ orderState: acknowledged, message: "Order status update failed!" })
            }

        } catch (error) {
            return res.status(200).json({ orderState: acknowledged, message: error.message })
        }
    }
}