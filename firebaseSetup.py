from firebase_admin import credentials, firestore, initialize_app

# initialize firebase
cred = credentials.Certificate("firebase-key.json")
initialize_app(cred)
db = firestore.client()