import json
import requests
import time
import os
from dotenv import load_dotenv


def get_presigned_url(api_key, extension='jpg'):
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json'
    }
    url = 'https://cloud.leonardo.ai/api/rest/v1/init-image'
    payload = {'extension': extension}
    response = requests.post(url, json=payload, headers=headers)
    if response.status_code == 200:
        upload_info = response.json()['uploadInitImage']
        return upload_info['url'], json.loads(upload_info['fields']), upload_info['id']
    else:
        raise Exception(f"Error obtaining presigned URL: {response.text}")



def upload_image(image_path, upload_url, fields):
    with open(image_path, 'rb') as image_file:
        files = {'file': image_file}
        response = requests.post(upload_url, data=fields, files=files)
    if response.status_code == 204:
        print('Image uploaded successfully.')
    else:
        raise Exception(f"Error uploading image: {response.text}")

def generate_image_with_reference(api_key, image_id, prompt, model_id='b24e16ff-06e3-43eb-8d33-4416c2d75876', height=768, width=512):
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json'
    }
    url = 'https://cloud.leonardo.ai/api/rest/v1/generations'
    payload = {
        'height': height,
        'width': width,
        'modelId': model_id,
        'prompt': prompt,
        'controlnets': [
            {
                'initImageId': image_id,
                'initImageType': 'UPLOADED',
                'preprocessorId': 133,  # Character Reference ID
                'strengthType': 'High'
            }
        ]
    }
    response = requests.post(url, json=payload, headers=headers)
    if response.status_code == 200:
        generation_id = response.json()['sdGenerationJob']['generationId']
        return generation_id
    else:
        raise Exception(f"Error initiating image generation: {response.text}")


def retrieve_generated_image(api_key, generation_id):
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json'
    }
    url = f'https://cloud.leonardo.ai/api/rest/v1/generations/{generation_id}'
    while True:
        response = requests.get(url, headers=headers)
        if response.status_code == 200:
            generation_data = response.json()['generations_by_pk']
            if generation_data['status'] == 'COMPLETE':
                return [img['url'] for img in generation_data['generated_images']]
            else:
                print('Generation in progress, waiting...')
                time.sleep(5)
        else:
            raise Exception(f"Error retrieving generated image: {response.text}")


def main(api_key, image_path, prompt):
    try:
        # Step 1: Get presigned URL
        upload_url, fields, image_id = get_presigned_url(api_key)

        # Step 2: Upload image
        upload_image(image_path, upload_url, fields)

        # Step 3: Generate image with reference
        generation_id = generate_image_with_reference(api_key, image_id, prompt)

        # Step 4: Retrieve generated image
        generated_image_urls = retrieve_generated_image(api_key, generation_id)
        for url in generated_image_urls:
            print('Generated image URL:', url)

    except Exception as e:
        print('An error occurred:', str(e))


if __name__ == '__main__':
    load_dotenv()
    api_key = os.getenv('API_KEY')
    if api_key is None:
        raise ValueError("API_KEY not found in environment variables.")
    image_path = 'Trial6.jpg'
    prompt = "Transform this image into a gaming-themed card while preserving the person's face. Surround them with a dynamic, neon-lit cyberpunk atmosphere featuring cool-toned lighting (blues, purples, and teals). Enhance the background with futuristic gaming elements like holographic effects, LED accents, and a digital overlay. Maintain sharp image quality, but ensure the overall look feels immersive and high-tech, as if part of a professional gaming poster."
    main(api_key, image_path, prompt)
