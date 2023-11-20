module.exports = {
    getAllRates: async (db, res) => {
        const rates = await db.collection('rate').find({}).toArray()
        res.status(200).json(rates)
    }
}