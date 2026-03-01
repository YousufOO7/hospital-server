const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require('mongodb');
require("dotenv").config();
const OpenAI = require("openai");
const app = express();
const port = process.env.PORT || 5000;
const openai = new OpenAI({
  apiKey: process.env.GROQ_MODEL,
  baseURL: "https://api.groq.com/openai/v1",
});


app.use(
  cors({
    origin: ["http://localhost:3000", 'https://hospital-management-vert-nu.vercel.app'],
    credentials: true,
  })
);
app.use(express.json());




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.6mmiv.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});
    let conversationMemory = {};


async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const allDoctorsCollection = client.db("smart_hospital").collection("allDoctors");

    app.get('/allDoctors', async (req, res) => {
        const result = await allDoctorsCollection.find().toArray();
        res.send(result); 
    })


     app.post("/chat", async (req, res) => {
      try {
        const { message, sessionId } = req.body;
        if (!sessionId) return res.status(400).json({ reply: "Session ID required" });

        const history = conversationMemory[sessionId] || [];

        // Fetch doctors from MongoDB
        const doctors = await allDoctorsCollection.find().toArray();
        const doctorContext = doctors.map((doc) => ({
          name: doc.name,
          specialization: doc.specialization,
          symptoms: doc.symptom_keywords,
          visit_charge: doc.visit_charge,
          visit_time: doc.visit_time,
        }));

        // System prompt: conversational + conditional doctor list
        const systemPrompt = `
You are a friendly hospital assistant. Converse naturally.
- Ask clarifying questions about symptoms before suggesting doctors.
- Only provide doctor recommendations if the user agrees.
- Keep responses concise.
- Users may speak English, Bangla, or Banglish.
- Here is the doctor data to suggest from if needed:
${JSON.stringify(doctorContext)}
        `;

        const completion = await openai.chat.completions.create({
          model: "openai/gpt-oss-120b",
          messages: [
            { role: "system", content: systemPrompt },
            ...history,
            { role: "user", content: message },
          ],
          temperature: 0.5,
        });

        const reply = completion.choices[0].message.content;

        // Save conversation memory
        conversationMemory[sessionId] = [
          ...history,
          { role: "user", content: message },
          { role: "assistant", content: reply },
        ];

        res.json({ reply });
      } catch (error) {
        console.error(error);
        res.status(500).json({ reply: "AI error occurred." });
      }
    });


    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send("Smart Hospital server is running")
})


app.listen(port, () => {
    console.log(`Server is running on port: ${port}`)
})