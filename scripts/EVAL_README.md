# Skin Tone Analysis Evaluation Script

This script evaluates the accuracy of the skin tone analysis API by running it against a set of labeled images.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create an evaluation directory structure:
   ```
   eval/
   ├── images/
   │   ├── img1.jpg
   │   ├── img2.jpg
   │   └── ...
   └── labels.json
   ```

3. Create `eval/labels.json` with the ground truth labels:
   ```json
   {
     "img1.jpg": "autumn",
     "img2.jpg": "winter",
     "img3.jpg": "spring",
     "img4.jpg": "summer"
   }
   ```

## Usage

1. Start your API server (if running locally):
   ```bash
   # For Vercel dev
   vercel dev
   
   # Or your local server
   npm run dev
   ```

2. Run the evaluation script:
   ```bash
   API_BASE=http://localhost:3000 npx tsx scripts/eval-skin-tone.ts ./eval/images ./eval/labels.json
   ```

   Or if your API is deployed:
   ```bash
   API_BASE=https://your-api.vercel.app npx tsx scripts/eval-skin-tone.ts ./eval/images ./eval/labels.json
   ```

## Output

The script will:
- Process each image through the API
- Compare predictions to ground truth labels
- Calculate top-1 and top-2 accuracy
- Generate a confusion matrix showing prediction patterns

Example output:
```
📊 RESULTS
============================================================
Total evaluated: 50
Top-1 accuracy: 72.00% (36/50)
Top-2 accuracy: 88.00% (44/50)

📈 Confusion Matrix (rows=true label, cols=predicted):
            spring     summer     autumn     winter     
spring      12 (80%)   2 (13%)    1 (7%)     0 (0%)    
summer      1 (7%)     11 (73%)   2 (13%)    1 (7%)    
autumn      0 (0%)     1 (7%)     13 (87%)   1 (7%)    
winter      0 (0%)     1 (7%)     1 (7%)     13 (87%)  
```

## Notes

- The script supports JPEG and PNG images
- Images are sent as base64-encoded data
- The API must return `season`, `seasonConfidence`, and optionally `seasonCandidates`
- Missing files or API errors are logged but don't stop the evaluation
