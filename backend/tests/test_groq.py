from dotenv import load_dotenv

load_dotenv()

import os

from groq import Groq

def test_groq_connection():
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        print("❌ Groq API failed: GROQ_API_KEY is not set in your .env file")
        return

    try:
        client = Groq(api_key=api_key)
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": "Say hello in exactly 5 words"}],
        )
        text = response.choices[0].message.content
        print(f"Response: {text}")
        print("✅ Groq API working correctly")
    except Exception as e:
        error = str(e)
        print(f"❌ Groq API failed: {error}")
        if "auth" in error.lower() or "api_key" in error.lower() or "401" in error:
            print("Hint: Your GROQ_API_KEY looks invalid. Double-check it at console.groq.com")


if __name__ == "__main__":
    test_groq_connection()
