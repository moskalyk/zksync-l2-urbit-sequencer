// talis
const WebSocket = require("ws");
const zksync = require("zksync");
const cron = require('node-cron');

// db
const Hyperbee = require('hyperbee')
const SDK = require('hyper-sdk')
// const {DB} = require('hyperbeedeebee')

const DB_NAME = 'TXS'

async function runEpochBatch(db) {

  // TODO: find the tx between certain times
  try{

    // gets data in the last 10 seconds
    const rs = db.createReadStream({ gte: new Date(Date.now() - 10000), lte: new Date() })

    rs
      .on('data', (el) => {
        console.log(JSON.parse(el.value))
      })
      .on('end', () => {
        // console.log(txs)
        // TODO: execute transaction batch on txs
      })

  }catch(e){
    console.log(e)
    console.log('error')
  }
}

async function sequencer() {
  // create connection to db

  const {Hypercore} = await SDK()

  // Initialize a hypercore for loading data
  const core = new Hypercore(DB_NAME)
  // Initialize the Hyperbee you want to use for storing data and indexes
  const db = new Hyperbee(core, {
    keyEncoding: 'utf-8', // can be set to undefined (binary), utf-8, ascii or and abstract-encoding
    valueEncoding: 'utf-8' // same options as above
  })

  // Create a new DB
  await db.put(new Date(), JSON.stringify({howdie: 'ho'}))

  // run tracer
  tracer(db)

  // TODO: create cron job to run every week
  cron.schedule('*/5 * * * * *', () => {
    console.log('running a task every 5 seconds');
    runEpochBatch(db)
  });
}

async function tracer(db, address = "0x7ca2113e931ada26f64da66822ece493f20059b6") {

  // Get the provider. It's important to specify the correct network.
  const provider = await zksync.getDefaultProvider("rinkeby");
  // Connect to the event server.
  const ws = new WebSocket("wss://events.zksync.io/");
  console.log("Connection established");
  // Change the address to the account you're intrested in.
  const ACCOUNT_ADDRESS = address;

  // Once connected, start sending ping frames.
  setInterval(function () {
    ws.ping();
  }, 10000);

  // Register filters.
  ws.on("open", function open() {
    ws.send("{}");
  });

  ws.on("close", function close(code, reason) {
    console.log(`Connection closed with code ${code}, reason: ${reason}`);
  });

  ws.on("message", async function (data) {
    const event = JSON.parse(data);

    // We are looking for transfers to the specific account.
    if (event.type == "transaction" && event.data.tx.type == "Transfer") {
      const recipient = event.data.tx.to;
      console.log(event.data)

      if (recipient != ACCOUNT_ADDRESS) {
        return;
      }
      // Use the provider for formatting.
      const token = provider.tokenSet.resolveTokenSymbol(event.data.token_id);
      const amount = provider.tokenSet.formatToken(token, event.data.tx.amount);

      const status = event.data.status;
      const fromAddr = event.data.tx.from;
      const blockNumber = event.block_number;

      console.log(`There was a transfer to ${recipient}`);
      console.log(`Block number: ${blockNumber}`);
      console.log(`From: ${fromAddr}`);
      console.log(`Token: ${token}`);
      console.log(`Amount: ${amount}`);
      console.log(`Status: ${status}\n`);

      //save to DB
      console.log(event.data.tx)
      await db.put(new Date(), JSON.stringify(event.data.tx))
    }
  });
}

(async () => {
  await sequencer();
})()