let { stateBus, pushUnique, now } = require('./shared')

module.exports = function (RED) {
  function Node(config) {
    RED.nodes.createNode(this, config)

    let node = this

    let heardFrom = []

    node.on('input', function (msg) {
      const THINGS = this.context().global.get('things')

      // Name should be set in properties, or provided on input.
      // Property takes precedence.
      let name = config.name || msg.topic

      if (!name) return node.error('Thing name is required in properties or input')

      // Pointer to the thing
      let thing = THINGS[name]

      // If not found and thing type is set, Try finding by ID (assuming topic is ID)
      if (!thing && config.thingType && msg.topic) {
        thing = Object.values(THINGS).find(t => t.type == config.thingType && t.id == msg.topic)
        if (thing) name = thing.name
      }

      // If still not found, error
      if (!thing) return node.error(`Unknown thing ${name}`)

      // Update state accordingly
      if (msg.replace) {
        thing.state = msg.payload
      } else {
        Object.assign(thing.state, msg.payload)
      }

      // Emit to the bus so that all other nodes that
      // are configured to output on changes/updates
      // will be triggered. (And update their status)
      stateBus.emit(name)

      // Check for parents and emit for them too
      thing.parents && thing.parents.forEach(parent => stateBus.emit(parent))

      // If configured with `type`, update status
      if (config.thingType) {
        pushUnique(heardFrom, name)

        let waitingOn = Object.values(THINGS)
          .filter(t => t.type == config.thingType && !heardFrom.includes(t.name))
          .map(t => t.name)

        node.status({
          text: `${config.thingType} ${
            waitingOn.length ? `waiting on (${waitingOn.length}) ${waitingOn.join(', ')}` : 'ready'
          }`
        })
      } else {
        // Not configured with `type`, so show status of this update
        node.status({
          text: `${thing.name} | ${JSON.stringify(msg.payload)} | ${now()}`
        })
      }
    })
  }
  RED.nodes.registerType('Thing Update', Node)
}
