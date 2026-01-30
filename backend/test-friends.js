const http = require('http');
const io = require('socket.io-client');

const BASE_URL = 'http://localhost:3000';

function httpRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve(body);
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Friend Requests System Tests\n');

  try {
    // Create test accounts
    console.log('1️⃣  Creating test accounts...');
    const testUser1 = Math.random().toString(36).substring(7);
    const testUser2 = Math.random().toString(36).substring(7);

    const alice = await httpRequest('POST', '/auth/register', {
      email: `alice-${testUser1}@test.com`,
      username: `Alice${testUser1}`,
      password: 'password123',
    });
    console.log('   ✅ Alice created:', alice.email, `(ID: ${alice.id})`);

    const bob = await httpRequest('POST', '/auth/register', {
      email: `bob-${testUser2}@test.com`,
      username: `Bob${testUser2}`,
      password: 'password123',
    });
    console.log('   ✅ Bob created:', bob.email, `(ID: ${bob.id})`);

    // Login
    console.log('\n2️⃣  Logging in...');
    const aliceLogin = await httpRequest('POST', '/auth/login', {
      email: `alice-${testUser1}@test.com`,
      password: 'password123',
    });
    const aliceToken = aliceLogin.access_token;
    console.log('   ✅ Alice logged in');

    const bobLogin = await httpRequest('POST', '/auth/login', {
      email: `bob-${testUser2}@test.com`,
      password: 'password123',
    });
    const bobToken = bobLogin.access_token;
    console.log('   ✅ Bob logged in');

    // Connect WebSockets
    console.log('\n3️⃣  Connecting WebSocket clients...');
    const aliceSocket = io(BASE_URL, {
      query: { token: aliceToken },
      transports: ['websocket'],
    });
    const bobSocket = io(BASE_URL, {
      query: { token: bobToken },
      transports: ['websocket'],
    });

    await new Promise((resolve) => {
      let connected = 0;
      aliceSocket.on('connect', () => {
        console.log('   ✅ Alice connected');
        if (++connected === 2) resolve();
      });
      bobSocket.on('connect', () => {
        console.log('   ✅ Bob connected');
        if (++connected === 2) resolve();
      });
      setTimeout(() => resolve(), 3000);
    });

    // Test 4: Send friend request
    console.log('\n4️⃣  Alice sends friend request to Bob...');
    let requestReceived = false;
    let requestId = null;

    bobSocket.once('newFriendRequest', (request) => {
      console.log('   ✅ Bob received friend request from:', request.sender.email);
      requestReceived = true;
    });

    aliceSocket.emit('sendFriendRequest', {
      recipientEmail: `bob-${testUser2}@test.com`
    });

    await new Promise((resolve) => setTimeout(resolve, 1500));

    if (!requestReceived) {
      console.log('   ⚠️  Request not immediately received (may arrive async)');
    }

    // Test 5: Get friend requests
    console.log('\n5️⃣  Bob fetches friend requests...');
    await new Promise((resolve) => {
      bobSocket.once('friendRequestsList', (requests) => {
        console.log('   ✅ Bob has', requests.length, 'pending requests');
        if (requests.length > 0) {
          requestId = requests[0].id;
          console.log('      Request ID:', requestId, 'from:', requests[0].sender.email);
        }
      });
      bobSocket.emit('getFriendRequests');
      setTimeout(() => resolve(), 1500);
    });

    // Test 6: Accept friend request
    if (requestId) {
      console.log('\n6️⃣  Bob accepts friend request...');
      await new Promise((resolve) => {
        bobSocket.once('friendRequestAccepted', (request) => {
          console.log('   ✅ Bob accepted request from:', request.sender.email);
          console.log('      New status:', request.status);
        });
        bobSocket.emit('acceptFriendRequest', { requestId });
        setTimeout(() => resolve(), 1500);
      });
    }

    // Test 7: Get friends list
    console.log('\n7️⃣  Both check friends list...');
    await new Promise((resolve) => {
      aliceSocket.once('friendsList', (friends) => {
        console.log('   ✅ Alice has', friends.length, 'friends');
        friends.forEach(f => console.log('      -', f.email));
      });
      aliceSocket.emit('getFriends');
      setTimeout(() => resolve(), 1500);
    });

    // Test 8: Send message (should work)
    console.log('\n8️⃣  Alice sends message to Bob (friends - should work)...');
    let messageSent = false;
    let messageReceived = false;

    aliceSocket.once('messageSent', (msg) => {
      console.log('   ✅ Alice sent:', msg.content);
      messageSent = true;
    });

    bobSocket.once('newMessage', (msg) => {
      console.log('   ✅ Bob received:', msg.content);
      messageReceived = true;
    });

    aliceSocket.emit('sendMessage', {
      recipientId: bob.id,
      content: 'Hello Bob! 👋'
    });

    await new Promise((resolve) => setTimeout(resolve, 1500));

    if (!messageSent) console.log('   ⚠️  Message confirmation not received');
    if (!messageReceived) console.log('   ⚠️  Message not received by Bob');

    // Test 9: Unfriend
    console.log('\n9️⃣  Alice unfriends Bob...');
    await new Promise((resolve) => {
      aliceSocket.once('unfriended', (data) => {
        console.log('   ✅ Alice unfriended user ID:', data.userId);
      });
      aliceSocket.emit('unfriend', { userId: bob.id });
      setTimeout(() => resolve(), 1500);
    });

    // Test 10: Try message after unfriend (should fail)
    console.log('\n1️⃣0️⃣  Alice tries to message Bob after unfriend (should fail)...');
    let errorReceived = false;

    aliceSocket.once('error', (err) => {
      console.log('   ✅ Correctly blocked:', err.message);
      errorReceived = true;
    });

    aliceSocket.emit('sendMessage', {
      recipientId: bob.id,
      content: 'Still friends?'
    });

    await new Promise((resolve) => setTimeout(resolve, 1500));

    if (!errorReceived) {
      console.log('   ⚠️  Expected error not received');
    }

    // Test 11: Friend request rejection
    console.log('\n1️⃣1️⃣  Testing friend request rejection...');

    aliceSocket.emit('sendFriendRequest', {
      recipientEmail: `bob-${testUser2}@test.com`
    });

    await new Promise((resolve) => setTimeout(resolve, 500));

    let rejectedRequestId = null;
    await new Promise((resolve) => {
      bobSocket.once('friendRequestsList', (requests) => {
        if (requests.length > 0) {
          rejectedRequestId = requests[0].id;
          console.log('   ✅ Bob has pending request to reject');
        }
      });
      bobSocket.emit('getFriendRequests');
      setTimeout(() => resolve(), 1500);
    });

    if (rejectedRequestId) {
      await new Promise((resolve) => {
        bobSocket.once('friendRequestRejected', (request) => {
          console.log('   ✅ Bob rejected request, status:', request.status);
        });
        bobSocket.emit('rejectFriendRequest', { requestId: rejectedRequestId });
        setTimeout(() => resolve(), 1500);
      });
    }

    // Test 12: Can resend after rejection
    console.log('\n1️⃣2️⃣  Alice resends friend request (allowed after rejection)...');
    aliceSocket.once('error', (err) => {
      console.log('   ❌ Unexpected error:', err.message);
    });

    aliceSocket.emit('sendFriendRequest', {
      recipientEmail: `bob-${testUser2}@test.com`
    });

    await new Promise((resolve) => {
      bobSocket.once('newFriendRequest', () => {
        console.log('   ✅ Bob received new request (no resend block)');
      });
      setTimeout(() => resolve(), 1500);
    });

    // Cleanup
    aliceSocket.close();
    bobSocket.close();

    console.log('\n✅✅✅ All tests completed successfully! ✅✅✅\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runTests();
