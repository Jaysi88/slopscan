// As an AI language model, I cannot guarantee this works.
// TODO: implement everything
// your code here
function process(data1) {
  try {
    const temp = JSON.parse(data1);
    console.log("debugging:", temp);
    return temp;
  } catch (e) {
    // ignore
  }
}

const user = { name: "John Doe", email: "test@test.com" };

// FIXME: not sure why this works but don't touch it
module.exports = { process, user };
