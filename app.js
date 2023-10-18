import express from 'express';
import connectDB from './config/db.js';
import urlsRouter from './routes/urls.js';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
dotenv.config({ path: './config/.env' });

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser())
app.use(express.json());
connectDB();

app.use('/health-check', (req, res) => {
    res.send('App is healthy')
});

app.use('/', urlsRouter);

// Server Setup
const PORT = process.env.PORT || 3333;
app.listen(PORT, () => {
    console.log(`Server is running at PORT ${PORT}`);
});