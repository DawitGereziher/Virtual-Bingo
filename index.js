const express = require('express');
const ticketRoutes = require('./Ticket/issue');
const cors = require('cors');
const http = require('http');
const verifyAgent = require('./middleware/verifyAgent');
const verifyAdmin = require('./middleware/verifyAdmin');
const {setupBingoSocket} = require('./game/bingoSocket');
const verifyEligibility = require('./game/verifyEligibility');
const authRoutes = require('./auth/login');
const adminLogin = require('./admin/login');
const adminSignup = require('./admin/signup'); 
const adminAgentRoutes = require('./admin/agents');
const adminTicketRoutes = require('./admin/tickets');


const app = express();
app.use(cors());
app.use(express.json());
app.use('/auth', authRoutes);
app.use('/tickets', ticketRoutes);
app.use('/agents', verifyEligibility);


app.use('/admin/agents',verifyAdmin, adminAgentRoutes);
app.use('/admin/tickets',verifyAdmin, adminTicketRoutes);
app.get('/auth/verify-admin', verifyAdmin, (req, res) => {
  res.json({
    valid: true,
    admin_id: req.admin.admin_id,
    username: req.admin.username,
  });
});

app.get('/auth/verify-agent', verifyAgent, (req, res) => {
  res.json({
    valid: true,
    agent_id: req.agent.agent_id,  // FIXED typo
    username: req.agent.username,
  });
});




app.use('/admin/login', adminLogin);
app.use('/admin/signup', adminSignup);
app.get('/', (req, res) => res.send('🎲 Bingo API is live'));

const server = http.createServer(app);
setupBingoSocket(server); 

server.listen(5000, () => {
  console.log('🚀 Server running at http://localhost:5000');
});
