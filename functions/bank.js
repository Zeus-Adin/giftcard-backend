

module.exports = {
    regUsersBankDetails: async (reqOptions, db, res) => {
        try {
            let active = false;
            const { id, username, name, code, account_number, account_name } = reqOptions;
            const bankInfo = await db.collection('bank').find({ $and: [{ id }, { username }] }).toArray();
            if (bankInfo.length === 0) { active = true }
            for (let i = 0; i < bankInfo.length; i++) {
                const { account_number: existAccountNumber } = bankInfo[i];
                if (existAccountNumber === account_number) {
                    res.status(500).json({ bankReg: false, message: 'Account already exists!' });
                    return
                }
            }

            if (bankInfo.length === 5) {
                res.status(500).json({ bankReg: false, message: 'Allowed number of banks reached!' });
                return
            }

            const { acknowledged } = await db.collection('bank').insertOne({ id, username, name, code, account_number, account_name, active })
            if (acknowledged) {
                res.status(200).json({ bankReg: acknowledged, message: 'Bank add successfully!' });
                return
            } else {
                res.status(500).json({ bankReg: acknowledged, message: 'Server error!' });
                return
            }
        } catch (err) {
            res.status(500).json({ bankReg: false, message: 'Unknown error occured, please try again!' });
            return
        }
    }    
}