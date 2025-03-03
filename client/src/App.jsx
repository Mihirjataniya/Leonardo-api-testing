import React, { useState } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [prompt, setPrompt] = useState('');
  const [generatedImages, setGeneratedImages] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImage(file);
      setImagePreview(URL.createObjectURL(file)); // Create preview URL
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!image || !prompt) {
      alert('Please upload an image and enter a prompt.');
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append('image', image);
    formData.append('prompt', prompt);

    try {
      const response = await axios.post('http://localhost:5000/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setGeneratedImages(response.data.images);
    } catch (error) {
      console.error('Error generating image:', error);
    }
    setLoading(false);
  };

  return (
    <div className="container">
      <h2>Leonardo AI Image Transformer</h2>
      
      <form onSubmit={handleSubmit}>
        <input type="file" accept="image/*" onChange={handleImageUpload} />
        
        {imagePreview && (
          <div className="preview-container">
            <p>Preview:</p>
            <img src={imagePreview} alt="Preview" className="preview-image" />
          </div>
        )}

        <textarea
          placeholder="Enter your prompt..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows="4"
          cols="50"
        />

        <button type="submit" disabled={loading}>
          {loading ? "Processing..." : "Generate Image"}
        </button>
      </form>

      <h3>Generated Images</h3>
      <div className="generated-images">
        {generatedImages.map((url, index) => (
          <img key={index} src={url} alt={`Generated ${index}`} className="generated-image" />
        ))}
      </div>
    </div>
  );
}

export default App;
