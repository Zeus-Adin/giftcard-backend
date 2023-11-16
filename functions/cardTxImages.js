require('dotenv').config();
const { Web3Storage, File } = require('web3.storage')
const token = process.env.WEB3_STORAGE_TOKEN;
const storageClient = new Web3Storage({ token })

module.exports = {
    storeCard: async (file, txId) => {
        const jsonBuffer = Buffer.from(JSON.stringify(file))
        const jsonFile = new File([jsonBuffer], txId + '.json', { type: 'application/json' })
        const cid = await storageClient.put([jsonFile]);
        return cid;
    },
    getCard: async (cid) => {
        try {
            const files = await storageClient.get(cid)
            return { success: true, result: files.url, message: 'Files retrieved', error: '' }
        } catch (error) {
            return { success: false, result: [], message: 'Error geting files', error: error }
        }
    }
}