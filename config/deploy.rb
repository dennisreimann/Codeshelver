# If Vlad does not find some commands, try the following:
#
# To enable per user PATH environments for ssh logins you
# need to add to your sshd_config:
# PermitUserEnvironment yes
#
# After that, restart sshd!
#
# Then in your "users" ssh home directory (~/.ssh/environment),
# add something to this effect (your mileage will vary):
# PATH=/opt/ruby-1.8.7/bin:/usr/local/bin:/bin:/usr/bin
#
# For details on that, see:
# http://zerobearing.com/2009/04/27/capistrano-rake-command-not-found
#
# Maybe you also need to configure SSH Agent Forwarding:
#
# $ ssh-add ~/.ssh/<private_keyname>
# 
# Edit your ~/.ssh/config file and add something like this:
# Host <name>
#   HostName <ip or host>
#   User <username>
#   IdentityFile ~/.ssh/<filename>
#   ForwardAgent yes
#
# For details on that, see:
# http://jordanelver.co.uk/articles/2008/07/10/rails-deployment-with-git-vlad-and-ssh-agent-forwarding/

set :user, "deploy"
set :application, "codeshelver"
set :domain, "innovated.de"
set :deploy_to, "/var/www/#{application}"
set :repository, "git@git.innovated.de:#{application}.git"
set :symlinks, { 'config/app.js' => 'config/app.js' }

require 'bundler/vlad'

namespace :vlad do
  
  desc 'Start the app'
  remote_task :start_app, :roles => :app do
    run "/etc/init.d/express_app #{application} start"
  end
  
  desc 'Stop the app'
  remote_task :stop_app, :roles => :app do
    run "/etc/init.d/express_app #{application} stop"
  end
  
  desc 'Restart the app'
  remote_task :restart_app, :roles => :app do
    %w(stop_app start_app).each { |task| Rake::Task["vlad:#{task}"].invoke }
  end
  
  desc 'Full deployment cycle'
  remote_task :deploy, :roles => :app do
    %w(update symlink ndistro:install_deps bundle:install restart_app cleanup).each do |task|
      Rake::Task["vlad:#{task}"].invoke
    end
  end
end