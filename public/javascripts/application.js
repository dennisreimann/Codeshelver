$(document).ready(function() {
  $('button.delete').click(function(e) {
    return confirm("Are you sure?");
  });
});