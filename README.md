# 🛡️ UPI Security Shield

A Machine Learning-based web application built with **Flask** and **TensorFlow** to detect fraudulent UPI transactions by analyzing transaction features and predicting risk levels in real time.

---

📌 **Project Objective**  
To build a system that analyzes UPI transaction data and predicts the likelihood of fraud using a trained neural network model.  
The project helps financial systems and users minimize risks in digital payments.

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-------------|
| **Frontend** | HTML, CSS, JavaScript |
| **Backend** | Flask (Python) |
| **Machine Learning** | TensorFlow, Pandas, NumPy |
| **Database** | MySQL |
| **Visualization** | Chart.js |
| **Server** | XAMPP / Localhost |

---

## 🚀 Features

- 🔍 **Fraud Detection Model:** Uses a Sequential Neural Network trained on transaction data to predict whether a transaction is safe or risky.  
- 📊 **Risk Level Dashboard:** Displays transactions by **Low**, **Medium**, and **High** risk levels using **Chart.js** visualizations.  
- 🧠 **AI-Driven Insights:** TensorFlow-based model trained to recognize suspicious transaction patterns.  
- 🔐 **User-Friendly Interface:** Built using **HTML, CSS, and JavaScript** for a responsive and intuitive frontend.  
- 🗄️ **Data Management:** MySQL database for storing user transactions and prediction results.

---

## ⚙️ How It Works

1. User enters or uploads transaction details.  
2. The trained model predicts the fraud risk level using TensorFlow.  
3. Results are displayed on a web dashboard with risk categorization (**Low / Medium / High**).  
4. Visual analytics are shown using Chart.js to highlight trends and transaction safety.

---

### 🧩 Setup Instructions

**Create a virtual environment:**
```bash
python -m venv venv
venv\Scripts\activate     # On Windows
pip install -r requirements.txt
python app.py
Visit http://localhost:5000 in your browser.

---  

## 📂 Modules

- **Data Preprocessing**  
  Cleans and prepares the dataset for model training.

- **Model Training**  
  Uses a Sequential Neural Network built in TensorFlow to predict transaction risks.

- **Prediction & Risk Analysis**  
  Processes user input and classifies it into different risk levels.

- **Visualization**  
  Displays results using dynamic charts and tables on the dashboard.

- **Database Management**  
  Stores transaction history and prediction outcomes securely in MySQL.

---

## 📜 Future Enhancements

- Integration with live UPI transaction APIs
- Enhanced model accuracy using deep learning architectures
- Implementation of user authentication and admin dashboard
