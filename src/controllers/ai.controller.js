export const generateResponse = async (req, res) => {
  try {
    const { prompt, robotId, servoPosition } = req.body;

    if (!prompt || !robotId) {
      return res.status(400).json({
        status: 'error',
        code: 'INVALID_INPUT',
        message: 'Prompt and robotId are required',
        data: null
      });
    }

    // Add personality context to every prompt
    const personalityContext = `You are a friendly robot assistant. 
    Response should be detailed and natural. When asked to look somewhere, 
    explain what you see or why you're looking there. For example, instead of just saying "Right!", 
    say "I'll look to the right! I can see [describe what's there]". Current position: ${servoPosition || 90} degrees.`;

    const fullPrompt = personalityContext + "\n" + prompt;
    
    // Use fetch to call the Gemini 2.0 Flash API directly
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: fullPrompt }]
          }]
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Gemini API error: ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    
    // Extract the text from the response
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I couldn't generate a response.";

    // Enhanced text processing
    let enhancedText = text;
    if (text.trim().toLowerCase() === 'right!' || text.trim().toLowerCase() === 'right') {
      enhancedText = "I'll look to the right! Let me see what's there for you.";
    } else if (text.trim().toLowerCase() === 'left!' || text.trim().toLowerCase() === 'left') {
      enhancedText = "I'll look to the left! Let me check what's there for you.";
    }

    // Determine response type and emotion
    const responseType = determineResponseType(prompt);
    const emotion = determineEmotion(enhancedText);

    const robotResponse = {
      status: 'success',
      code: 'RESPONSE_GENERATED',
      message: 'Response generated successfully',
      data: {
        robotId: robotId,
        timestamp: Date.now(),
        response: {
          text: enhancedText,
          type: responseType,
          emotion: emotion
        },
        movement: parseServoCommand(enhancedText, responseType, prompt),
        conversation: {
          questionType: responseType,
          isPersonal: responseType === 'IDENTITY',
          requiresMovement: shouldMove(responseType)
        },
        currentServoPosition: servoPosition || 90
      }
    };

    res.json(robotResponse);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      status: 'error',
      code: 'PROCESSING_ERROR',
      message: 'Failed to generate response',
      data: null
    });
  }
};

// Update parseServoCommand to also check the original prompt
function parseServoCommand(text, responseType, prompt) {
  const movement = {
    direction: 'none',
    angle: 90,
    reason: 'no movement needed'
  };

  const checkText = (text + ' ' + prompt).toLowerCase();

  if (responseType === 'MOVEMENT' || checkText.includes('look')) {
    if (checkText.includes('right')) {
      movement.direction = 'right';
      movement.angle = 180;
      movement.reason = 'looking right as requested';
    } else if (checkText.includes('left')) {
      movement.direction = 'left';
      movement.angle = 0;
      movement.reason = 'looking left as requested';
    } else if (checkText.includes('straight') || checkText.includes('forward')) {
      movement.direction = 'center';
      movement.angle = 90;
      movement.reason = 'looking straight ahead';
    }
  }

  return movement;
}

function determineResponseType(prompt) {
  const promptLower = prompt.toLowerCase();
  if (promptLower.includes('who are you') || promptLower.includes('your name')) {
    return 'IDENTITY';
  }
  if (promptLower.includes('who is') || promptLower.includes('what is')) {
    return 'INFORMATION';
  }
  if (promptLower.includes('can you') || promptLower.includes('could you')) {
    return 'CAPABILITY';
  }
  if (promptLower.includes('look') || promptLower.includes('turn')) {
    return 'MOVEMENT';
  }
  return 'GENERAL';
}

function determineEmotion(text) {
  if (text.includes('sorry') || text.includes('cannot') || text.includes('can\'t')) {
    return 'apologetic';
  }
  if (text.includes('!')) {
    return 'excited';
  }
  if (text.includes('?')) {
    return 'curious';
  }
  return 'neutral';
}

function shouldMove(responseType) {
  return ['MOVEMENT', 'IDENTITY'].includes(responseType);
}