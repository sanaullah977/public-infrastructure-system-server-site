const express = require('express');
require("dotenv").config();
const cors = require('cors')
const app = express();
const port = process.env.PORT || 3000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = "mongodb+srv://project11:nQTBSl8ISBg39qHh@public-infrastructure.3fprkup.mongodb.net/?appName=Public-Infrastructure";

app.use(cors());
app.use(express.json());

const admin = require("firebase-admin");

// jwt middlewares
const verifyJWT = async (req, res, next) => {
  const token = req?.headers?.authorization?.split(' ')[1]
  console.log(token)
  if (!token) return res.status(401).send({ message: 'Unauthorized Access!' })
  try {
    const decoded = await admin.auth().verifyIdToken(token)
    req.tokenEmail = decoded.email
    console.log(decoded)
    next()
  } catch (err) {
    console.log(err)
    return res.status(401).send({ message: 'Unauthorized Access!', err })
  }
}

const decoded = Buffer.from(process.env.srvice_key, "base64").toString("utf8");
const serviceAccount = JSON.parse(decoded);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});


const verifyToken = async (req, res, next) => {
  const authorization = req.headers.authorization;

  if (!authorization) {
    return res.status(401).send({
      message: "unauthorized access. Token not found!",
    });
  }

  const token = authorization.split(" ")[1];
  try {
    await admin.auth().verifyIdToken(token);

    next();
  } catch (error) {
    res.status(401).send({
      message: "unauthorized access.",
    });
  }
};




const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
 
    await client.connect();

    const db = client.db('infrastructur')
    const issuesdetailsCollection = db.collection('issues')
    const userCollection =db.collection('user')
    const staffeRequetsCollection =db.collection('user')

   
    const verifyADMIN = async (req, res, next) => {
      const email = req.tokenEmail
      const user = await userCollection.findOne({ email })
      if (user?.role !== 'admin')
        return res
          .status(403)
          .send({ message: 'Admin only Actions!', role: user?.role })

      next()
    }
    const verifySELLER = async (req, res, next) => {
      const email = req.tokenEmail
      const user = await userCollection.findOne({ email })
      if (user?.role !== 'seller')
        return res
          .status(403)
          .send({ message: 'Seller only Actions!', role: user?.role })

      next()
    }

    app.get('/issues', async (req,res) => {
      let query={}
      const email =req.query.email
      const category =req.query.category
      if (email) {
        query.providerEmail =email
      }
      if (category) {
        query.category=category
      }
      const result =await issuesdetailsCollection.find(query).toArray()
      console.log(result)
      res.send(result)
      
    });

    app.post('/issues', async (req,res)=> {
      const data = req.body
      // const query = new ObjectId(id)
      const result = await issuesdetailsCollection.insertOne(data)
      res.send({
        success:true,
        result
      })
    });

     app.get('/issues/:id',verifyToken, async(req,res) => {
      const {id} =req.params
      console.log(id)
      const query = new ObjectId(id)
      // const result = await issuesdetailsCollection.findOne({_id:id})
       const result = await issuesdetailsCollection.findOne({_id:query})
      res.send({
        success :true,
        result
      })
    });

     app.delete('/issues/:id', async (req,res) => {
      const {id} =req.params
      const query = new ObjectId(id)
       const result = await issuesdetailsCollection.deleteOne({_id:query})

       res.send({
        success: true,
        result
       })

    });

    app.post('/user', async (req, res) => {
      const userData = req.body
      userData.created_at = new Date().toISOString()
      userData.last_loggedIn = new Date().toISOString()
      userData.role = 'clinte'

      const query = {
        email: userData.email,
      }

      const alreadyExists = await userCollection.findOne(query)
      console.log('User Already Exists---> ', !!alreadyExists)

      if (alreadyExists) {
        console.log('Updating user info......')
        const result = await userCollection.updateOne(query, {
          $set: {
            last_loggedIn: new Date().toISOString(),
          },
        })
        return res.send(result)
      }

      console.log('Saving new user info......')
      const result = await userCollection.insertOne(userData)
      res.send(result)
    });

     
    app.get('/user/role', verifyJWT, async (req, res) => {
      const result = await userCollection.findOne({ email: req.tokenEmail })
      res.send({ role: result?.role })
    })

    
    app.post('/become-staffe', verifyJWT, verifyADMIN,async (req, res) => {
      const email = req.tokenEmail
      const alreadyExists = await staffeRequetsCollection.findOne({ email })
      if (alreadyExists)
        return res
          .status(409)
          .send({ message: 'Already requested, wait koro.' })

      const result = await staffeRequetsCollection.insertOne({ email })
      res.send(result)
    })

    
    app.get('/staffe-requests', verifyJWT,verifyADMIN, async (req, res) => {
      const result = await staffeRequetsCollection.find().toArray()
      res.send(result)
    })

    
    app.get('/users', verifyJWT,verifyADMIN,  async (req, res) => {
      const adminEmail = req.tokenEmail
      const result = await userCollection
        .find({ email: { $ne: adminEmail } })
        .toArray()
      res.send(result)
    })

   
    app.patch('/update-role', verifyJWT,verifyADMIN, async (req, res) => {
      const { email, role } = req.body
      const result = await userCollection.updateOne(
        { email },
        { $set: { role } }
      )
     

      res.send(result)
    })

    





    
   
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
