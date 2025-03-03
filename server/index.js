require('dotenv').config();
const express = require('express');
const axios = require('axios');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const FormData = require('form-data');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());


const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage });
const API_KEY = process.env.API_KEY;


if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

// Get presigned URL from Leonardo AI
async function getPresignedUrl(extension = 'jpg') {
    try {
        console.log(`Requesting presigned URL for extension: ${extension}`);
        const response = await axios.post(
            'https://cloud.leonardo.ai/api/rest/v1/init-image',
            { extension },
            { 
                headers: { 
                    Authorization: `Bearer ${API_KEY}`, 
                    'Content-Type': 'application/json' 
                } 
            }
        );
        console.log('Received presigned URL data');
        return response.data.uploadInitImage;
    } catch (error) {
        console.error('Presigned URL error:', error);
        const errorMessage = error.response?.data || error.message || 'Unknown error';
        throw new Error(`Error obtaining presigned URL: ${JSON.stringify(errorMessage)}`);
    }
}

// Upload image to S3 using Leonardo's presigned URL
async function uploadImageToLeonardo(imagePath, uploadUrl, fields) {
    try {
        console.log('Preparing to upload image to S3...');
        
        const parsedFields = typeof fields === 'string' ? JSON.parse(fields) : fields;
 
        const formData = new FormData();
        
      
        Object.entries(parsedFields).forEach(([key, value]) => {
            formData.append(key, value);
        });
       
        const fileStream = fs.createReadStream(imagePath);
        formData.append('file', fileStream);
        
        console.log('Uploading to S3:', uploadUrl);
        
       
        const response = await axios.post(uploadUrl, formData, {
            headers: {
                ...formData.getHeaders(),
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });
        
        console.log('Upload successful:', response.status);
        return response;
    } catch (error) {
        console.error('Upload error occurred:');
        
        if (error.response) {
            console.error('Error response status:', error.response.status);
            console.error('Error response data:', error.response.data);
        } else {
            console.error('Error message:', error.message);
        }
        
        throw new Error(`Error uploading image: ${error.message}`);
    }
}

// Generate image using the uploaded reference
async function generateImage(imageId, prompt) {
    try {
        console.log('Generating image with ID:', imageId);
        console.log('Using prompt:', prompt);
        
        const payload = {
            height: 768,
            width: 512,
            modelId: 'b24e16ff-06e3-43eb-8d33-4416c2d75876', // ControlNet model
            prompt: prompt,
            controlnets: [
                {
                    initImageId: imageId,
                    initImageType: 'UPLOADED',
                    preprocessorId: 133, // Canny edge preprocessor
                    strengthType: 'High'
                }
            ]
        };

        console.log('Sending generation request');
        
        const response = await axios.post(
            'https://cloud.leonardo.ai/api/rest/v1/generations',
            payload,
            { 
                headers: { 
                    Authorization: `Bearer ${API_KEY}`, 
                    'Content-Type': 'application/json' 
                } 
            }
        );
        console.log('Generation initiated, ID:', response.data.sdGenerationJob.generationId);
        return response.data.sdGenerationJob.generationId;
    } catch (error) {
        console.error('Generation error:', error);
        const errorMessage = error.response?.data || error.message || 'Unknown error';
        throw new Error(`Error generating image: ${JSON.stringify(errorMessage)}`);
    }
}

// Retrieve the generated image URLs
async function getGeneratedImages(generationId) {
    const url = `https://cloud.leonardo.ai/api/rest/v1/generations/${generationId}`;
    let attempts = 0;
    const maxAttempts = 30; 

    console.log('Waiting for generation to complete, ID:', generationId);
    
    while (attempts < maxAttempts) {
        try {
            console.log(`Checking generation status (attempt ${attempts + 1})...`);
            
            const response = await axios.get(url, { 
                headers: { Authorization: `Bearer ${API_KEY}` } 
            });
            
            const data = response.data.generations_by_pk;
            console.log('Generation status:', data.status);
            
            if (data.status === 'COMPLETE') {
                console.log('Generation complete!');
                console.log('Number of images:', data.generated_images.length);
                return data.generated_images.map(img => img.url);
            } else if (data.status === 'FAILED') {
                console.error('Generation failed:', data.message || 'Unknown reason');
                throw new Error(`Generation failed: ${data.message || 'Unknown reason'}`);
            }
            
            attempts++;
            console.log('Waiting 10 seconds before next check...');
            await new Promise(resolve => setTimeout(resolve, 10000)); // Check every 10 seconds
        } catch (error) {
            console.error('Error checking generation status:', error);
            throw new Error(`Error retrieving generated images: ${error.message}`);
        }
    }
    
    throw new Error('Timed out waiting for image generation to complete');
}

// Express route to handle image processing
app.post('/upload', upload.single('image'), async (req, res) => {
    let imagePath = null;
    
    try {
        console.log('Received upload request');
        
        const { prompt } = req.body;
        if (!req.file) {
            return res.status(400).json({ error: 'No image file uploaded' });
        }
        if (!prompt) {
            return res.status(400).json({ error: 'No prompt provided' });
        }

        imagePath = req.file.path;
        console.log('Image saved to:', imagePath);
        console.log('File info:', req.file);

        // Step 1: Get presigned URL with the correct file extension
        const fileExtension = path.extname(req.file.originalname).replace('.', '') || 'jpg';
        console.log(`Getting presigned URL for extension: ${fileExtension}`);
        const uploadData = await getPresignedUrl(fileExtension);
        console.log('Received presigned URL and image ID:', uploadData.id);

        // Step 2: Upload image - Using the format from Leonardo AI docs
        console.log('Uploading image to Leonardo AI...');
        await uploadImageToLeonardo(imagePath, uploadData.url, uploadData.fields);
        console.log('Image uploaded successfully');
        
        // Delete local file after upload
        try {
            fs.unlinkSync(imagePath);
            imagePath = null;
            console.log('Temporary file deleted');
        } catch (err) {
            console.error('Error deleting file:', err);
            // Continue execution even if file deletion fails
        }

        // Step 3: Generate new image
        console.log('Initiating image generation...');
        const generationId = await generateImage(uploadData.id, prompt);
        console.log('Generation initiated, ID:', generationId);

        // Step 4: Retrieve generated images
        console.log('Waiting for generation to complete...');
        const generatedImageUrls = await getGeneratedImages(generationId);
        console.log('Retrieved generated image URLs:', generatedImageUrls);

        res.json({ images: generatedImageUrls });
    } catch (error) {
        console.error('Server error:', error);
        
        // Clean up temporary file if it exists and hasn't been deleted
        if (imagePath && fs.existsSync(imagePath)) {
            try {
                fs.unlinkSync(imagePath);
                console.log('Temporary file deleted after error');
            } catch (err) {
                console.error('Error deleting file after error:', err);
            }
        }
        
        res.status(500).json({ error: error.message });
    }
});



const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));