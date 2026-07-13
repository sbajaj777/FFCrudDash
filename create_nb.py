import jupytext
import nbformat
from nbclient import NotebookClient

# Read the Python file and convert to notebook node
nb = jupytext.read('eia_regression_pipeline.py')

# Execute the notebook
client = NotebookClient(nb, timeout=600, kernel_name='python3')
client.execute()

# Save the executed notebook
with open('eia_regression_results.ipynb', 'w', encoding='utf-8') as f:
    nbformat.write(nb, f)

print("Notebook successfully generated and executed!")
