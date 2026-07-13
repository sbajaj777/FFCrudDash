import pandas as pd
import numpy as np
import os
from sentence_transformers import SentenceTransformer

def build_embeddings(input_csv, output_npy, final_csv):
    print(f"Loading events from {input_csv}...")
    df = pd.read_csv(input_csv)
    
    # Initialize the model
    print("Loading SentenceTransformer model 'all-MiniLM-L6-v2'...")
    model = SentenceTransformer('all-MiniLM-L6-v2')
    
    # We will embed the 'headline' column. 
    # Let's replace any nulls with empty strings just in case
    headlines = df['headline'].fillna("").tolist()
    
    print("Generating embeddings (this may take a moment)...")
    embeddings = model.encode(headlines, show_progress_bar=True)
    
    # Save the embeddings to a numpy file
    np.save(output_npy, embeddings)
    print(f"Saved embeddings of shape {embeddings.shape} to {output_npy}")
    
    # Save the final CSV (just to confirm we ran step 6 successfully)
    df.to_csv(final_csv, index=False)
    print(f"Saved final DB to {final_csv}")

if __name__ == "__main__":
    # Ensure HuggingFace cache doesn't fill up C drive
    os.environ['HF_HOME'] = r'F:\temp\hf_cache'
    
    input_csv = r"f:\dashboard 2\engine\data\historical_events.csv"
    output_npy = r"f:\dashboard 2\engine\data\headline_embeddings.npy"
    final_csv = r"f:\dashboard 2\engine\data\historical_events_final.csv"
    
    build_embeddings(input_csv, output_npy, final_csv)
