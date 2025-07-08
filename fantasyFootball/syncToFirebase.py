from localStorage import syncToFirebase, loadFromFiles
from firebaseSetup import db

def main():
    # Load the local data first
    loadFromFiles()
    
    # Sync to Firebase
    syncToFirebase(db)
    print("Successfully synced all data to Firebase")

if __name__ == "__main__":
    main() 